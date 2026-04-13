import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import {
  collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

// ─── Data ────────────────────────────────────────────────────────────────────
const FLAVORS = [
  { id: 'verde',        name: 'Batido Verde',  emoji: '🥬', cssClass: 'verde' },
  { id: 'antioxidante', name: 'Antioxidante',  emoji: '🫐', cssClass: 'antioxidante' },
  { id: 'boost',        name: 'Boost Inmune',  emoji: '🧡', cssClass: 'boost' },
];

const DEFAULT_STOCK = { verde: 0, antioxidante: 0, boost: 0 };

const STATUSES = [
  { id: 'pendiente',  label: 'Pendiente',  cssClass: 'status-pendiente' },
  { id: 'preparando', label: 'Preparando', cssClass: 'status-preparando' },
  { id: 'entregado',  label: 'Entregado',  cssClass: 'status-entregado' },
  { id: 'pagado',     label: 'Pagado',     cssClass: 'status-pagado' },
  { id: 'cancelado',  label: 'Cancelado',  cssClass: 'status-cancelado' },
];

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]           = useState('dashboard');
  const [stock, setStock]         = useState(DEFAULT_STOCK);
  const [orders, setOrders]       = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading]     = useState(true);

  // ── Firestore: real-time listeners ──
  useEffect(() => {
    const unsubStock = onSnapshot(doc(db, 'config', 'stock'), (snap) => {
      if (snap.exists()) setStock(snap.data());
      setLoading(false);
    });

    const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    const unsubOrders = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
    });

    return () => { unsubStock(); unsubOrders(); };
  }, []);

  const totalStock = stock.verde + stock.antioxidante + stock.boost;

  const placeOrder = useCallback(async (order) => {
    const newStock = {
      verde:        stock.verde        - order.quantities.verde,
      antioxidante: stock.antioxidante - order.quantities.antioxidante,
      boost:        stock.boost        - order.quantities.boost,
    };
    await setDoc(doc(db, 'config', 'stock'), newStock);
    await addDoc(collection(db, 'orders'), order);
    setPage('orders');
  }, [stock]);

  const deleteOrder = useCallback(async (id) => {
    await deleteDoc(doc(db, 'orders', id));
  }, []);

  const editOrder = useCallback(async (id, updates) => {
    await updateDoc(doc(db, 'orders', id), updates);
  }, []);

  const bulkPlaceOrders = useCallback(async (ordersList) => {
    let newStock = { ...stock };
    const batch = writeBatch(db);

    for (const order of ordersList) {
      newStock.verde        -= order.quantities.verde;
      newStock.antioxidante -= order.quantities.antioxidante;
      newStock.boost        -= order.quantities.boost;
      const ref = doc(collection(db, 'orders'));
      batch.set(ref, order);
    }

    batch.set(doc(db, 'config', 'stock'), newStock);
    await batch.commit();
    setPage('orders');
  }, [stock]);

  const navigate = (p) => { setPage(p); setMobileOpen(false); };

  const pages = { dashboard: 'Inicio', neworder: 'Nuevo Pedido', bulk: 'Carga Masiva', inventory: 'Inventario', orders: 'Pedidos' };
  const navIcons = { dashboard: '📊', neworder: '➕', bulk: '📄', inventory: '📦', orders: '📋' };

  return (
    <div className="app-layout">
      {/* Mobile hamburger */}
      <button className="mobile-toggle" onClick={() => setMobileOpen(o => !o)}>
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">Frizo</div>
          <div className="sidebar-logo-sub">Bolsas de Smoothie</div>
        </div>
        <nav className="sidebar-nav">
          {Object.entries(pages).map(([key, label]) => (
            <button
              key={key}
              className={`nav-link${page === key ? ' active' : ''}`}
              onClick={() => navigate(key)}
            >
              <span className="nav-icon">{navIcons[key]}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="stock-badge">
            <span className="stock-badge-num">{totalStock}</span>
            <span>bolsas en stock</span>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <main className="main-content">
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-text">Cargando...</div>
          </div>
        ) : (
        <div className="page-enter" key={page}>
          {page === 'dashboard'  && <Dashboard stock={stock} orders={orders} navigate={navigate} />}
          {page === 'inventory'  && <Inventory stock={stock} setStock={setStock} />}
          {page === 'neworder'   && <NewOrder  stock={stock} onPlace={placeOrder} />}
          {page === 'bulk'       && <BulkUpload stock={stock} onPlace={bulkPlaceOrders} />}
          {page === 'orders'     && <OrdersList orders={orders} onDelete={deleteOrder} onEdit={editOrder} />}
        </div>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ stock, orders, navigate }) {
  const totalStock = stock.verde + stock.antioxidante + stock.boost;
  const totalBagsSold = orders.reduce((s, o) => s + o.totalBags, 0);
  const maxStock = Math.max(totalStock, 1);
  const recent = orders.slice(0, 5);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Inicio</h1>
        <p className="page-subtitle">Resumen de tu negocio de smoothies</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Pedidos Totales</div>
          <div className="stat-number">{orders.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bolsas Vendidas</div>
          <div className="stat-number">{totalBagsSold}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En Stock</div>
          <div className="stat-number accent">{totalStock}</div>
        </div>
      </div>

      <h2 className="section-title">Desglose de Inventario</h2>
      <div className="flavor-grid" style={{ marginBottom: 32 }}>
        {FLAVORS.map(f => (
          <div key={f.id} className={`flavor-card ${f.cssClass}`}>
            <div className="flavor-emoji">{f.emoji}</div>
            <div className="flavor-name">{f.name}</div>
            <div className="flavor-stock-number">{stock[f.id]}</div>
            <div className="flavor-stock-label">bolsas</div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${(stock[f.id] / maxStock) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Pedidos Recientes</h2>
        {orders.length > 5 && (
          <button className="btn btn-sm btn-primary" onClick={() => navigate('orders')}>
            Ver Todos
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🥤</div>
          <div className="empty-state-text">Aun no hay pedidos. Crea tu primer pedido!</div>
        </div>
      ) : (
        <div className="orders-list">
          {recent.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </>
  );
}

// ─── Inventory ───────────────────────────────────────────────────────────────
function Inventory({ stock, setStock }) {
  const [draft, setDraft]     = useState({ ...stock });
  const [saved, setSaved]     = useState(false);
  const totalStock = stock.verde + stock.antioxidante + stock.boost;
  const maxStock = Math.max(totalStock, 1);

  const update = (id, val) => {
    const n = Math.max(0, typeof val === 'string' ? (parseInt(val, 10) || 0) : val);
    setDraft(d => ({ ...d, [id]: n }));
  };

  const save = async () => {
    await setDoc(doc(db, 'config', 'stock'), { ...draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Inventario</h1>
        <p className="page-subtitle">Administra el stock de tus bolsas de smoothie</p>
      </div>

      {saved && <div className="success-banner">Inventario guardado exitosamente!</div>}

      <div className="flavor-grid">
        {FLAVORS.map(f => (
          <div key={f.id} className={`flavor-card ${f.cssClass}`}>
            <div className="flavor-emoji">{f.emoji}</div>
            <div className="flavor-name">{f.name}</div>
            <div className="flavor-stock-number">{draft[f.id]}</div>
            <div className="flavor-stock-label">bolsas</div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${(draft[f.id] / Math.max(draft.verde + draft.antioxidante + draft.boost, 1)) * 100}%` }}
              />
            </div>
            <div className="qty-controls">
              <button className="qty-btn" onClick={() => update(f.id, draft[f.id] - 1)}>−</button>
              <input
                className="qty-input"
                type="number"
                min="0"
                value={draft[f.id]}
                onChange={e => update(f.id, e.target.value)}
              />
              <button className="qty-btn" onClick={() => update(f.id, draft[f.id] + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={save} style={{ marginTop: 8 }}>
        💾 Guardar Inventario
      </button>
    </>
  );
}

// ─── New Order ───────────────────────────────────────────────────────────────
function NewOrder({ stock, onPlace }) {
  const [customer, setCustomer]     = useState('');
  const [location, setLocation]     = useState('');
  const [notes, setNotes]           = useState('');
  const [quantities, setQuantities] = useState({ verde: 0, antioxidante: 0, boost: 0 });
  const [errors, setErrors]         = useState({});

  const totalBags = quantities.verde + quantities.antioxidante + quantities.boost;

  const updateQty = (id, val) => {
    const n = Math.max(0, typeof val === 'string' ? (parseInt(val, 10) || 0) : val);
    setQuantities(q => ({ ...q, [id]: n }));
  };

  const stockWarnings = FLAVORS.filter(f => quantities[f.id] > stock[f.id]);

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!customer.trim()) errs.customer = 'El nombre del cliente es obligatorio';
    if (totalBags === 0) errs.total = 'Agrega al menos 1 bolsa';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onPlace({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      customer: customer.trim(),
      location: location.trim(),
      notes: notes.trim(),
      quantities: { ...quantities },
      totalBags,
      status: 'pendiente',
      date: new Date().toISOString(),
    });
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Nuevo Pedido</h1>
        <p className="page-subtitle">Crea un nuevo pedido de bolsas de smoothie</p>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Nombre del Cliente *</label>
            <input
              className="form-input"
              placeholder="ej. María López"
              value={customer}
              onChange={e => { setCustomer(e.target.value); setErrors(er => ({ ...er, customer: undefined })); }}
            />
            {errors.customer && <div className="form-error">{errors.customer}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Ubicacion / Direccion de Entrega</label>
            <input
              className="form-input"
              placeholder="ej. Calle 5, Edificio Sol, Apto 3B"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cantidades por sabor</label>
            {stockWarnings.length > 0 && (
              <div className="warning-banner">
                El stock quedara en negativo para: {stockWarnings.map(f => f.name).join(', ')}
              </div>
            )}
            <div className="order-flavors">
              {FLAVORS.map(f => (
                <div key={f.id} className="order-flavor-card">
                  <div className="order-flavor-header">
                    <span>{f.emoji}</span>
                    <span className="order-flavor-name">{f.name}</span>
                  </div>
                  <div className="order-flavor-stock">
                    {stock[f.id]} en stock
                  </div>
                  <div className="qty-controls">
                    <button type="button" className="qty-btn" onClick={() => updateQty(f.id, quantities[f.id] - 1)}>−</button>
                    <input
                      className="qty-input"
                      type="number"
                      min="0"
                      value={quantities[f.id]}
                      onChange={e => updateQty(f.id, e.target.value)}
                    />
                    <button type="button" className="qty-btn" onClick={() => updateQty(f.id, quantities[f.id] + 1)}>+</button>
                  </div>
                  {quantities[f.id] > stock[f.id] && <div className="form-error">Stock quedara en {stock[f.id] - quantities[f.id]}</div>}
                </div>
              ))}
            </div>
            {errors.total && <div className="form-error" style={{ marginTop: 8 }}>{errors.total}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Notas (opcional)</label>
            <textarea
              className="form-textarea"
              placeholder="ej. entregar el viernes, pagado por adelantado"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="order-total">
            <span className="order-total-label">Total de bolsas</span>
            <span className="order-total-number">{totalBags}</span>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 8, width: '100%' }}>
            Confirmar Pedido
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Bulk Upload ────────────────────────────────────────────────────────────
function BulkUpload({ stock, onPlace }) {
  const [rows, setRows]         = useState([]);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const COLUMN_MAP = {
    'nombre':        'customer',
    'batido verde':  'verde',
    'antioxidante':  'antioxidante',
    'boost inmune':  'boost',
    'ubicacion':     'location',
    'ubicación':     'location',
    'notas':         'notes',
  };

  const handleFile = (e) => {
    setError('');
    setRows([]);
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) { setError('El archivo esta vacio.'); return; }

        const headers = Object.keys(json[0]);
        const colMap = {};
        for (const h of headers) {
          const key = h.trim().toLowerCase();
          if (COLUMN_MAP[key]) colMap[h] = COLUMN_MAP[key];
        }

        if (!Object.values(colMap).includes('customer')) {
          setError('No se encontro la columna "Nombre".');
          return;
        }

        const parsed = json.map(row => {
          const customer = String(row[headers.find(h => colMap[h] === 'customer')] || '').trim();
          const verde        = parseInt(row[headers.find(h => colMap[h] === 'verde')]        || 0, 10) || 0;
          const antioxidante = parseInt(row[headers.find(h => colMap[h] === 'antioxidante')] || 0, 10) || 0;
          const boost        = parseInt(row[headers.find(h => colMap[h] === 'boost')]        || 0, 10) || 0;
          const location     = String(row[headers.find(h => colMap[h] === 'location')] || '').trim();
          const notes        = String(row[headers.find(h => colMap[h] === 'notes')]    || '').trim();
          const totalBags = verde + antioxidante + boost;
          return { customer, quantities: { verde, antioxidante, boost }, totalBags, location, notes };
        }).filter(r => r.customer && r.totalBags > 0);

        if (parsed.length === 0) { setError('No se encontraron pedidos validos en el archivo.'); return; }
        setRows(parsed);
      } catch {
        setError('No se pudo leer el archivo. Asegurate de que sea un .xlsx o .xls valido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const totalVerde        = rows.reduce((s, r) => s + r.quantities.verde, 0);
  const totalAntioxidante = rows.reduce((s, r) => s + r.quantities.antioxidante, 0);
  const totalBoost        = rows.reduce((s, r) => s + r.quantities.boost, 0);
  const totalBags         = rows.reduce((s, r) => s + r.totalBags, 0);

  const stockWarnings = [];
  if (totalVerde > stock.verde)               stockWarnings.push(`Batido Verde: necesitas ${totalVerde}, tienes ${stock.verde} (quedara en ${stock.verde - totalVerde})`);
  if (totalAntioxidante > stock.antioxidante) stockWarnings.push(`Antioxidante: necesitas ${totalAntioxidante}, tienes ${stock.antioxidante} (quedara en ${stock.antioxidante - totalAntioxidante})`);
  if (totalBoost > stock.boost)               stockWarnings.push(`Boost Inmune: necesitas ${totalBoost}, tienes ${stock.boost} (quedara en ${stock.boost - totalBoost})`);

  const handleSubmit = async () => {
    setSubmitting(true);
    const orders = rows.map(r => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      customer: r.customer,
      location: r.location,
      notes: r.notes,
      quantities: r.quantities,
      totalBags: r.totalBags,
      status: 'pendiente',
      date: new Date().toISOString(),
    }));
    await onPlace(orders);
  };

  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Carga Masiva</h1>
        <p className="page-subtitle">Sube un archivo Excel para crear varios pedidos a la vez</p>
      </div>

      <div className="card" style={{ maxWidth: 900 }}>
        <div className="form-group">
          <label className="form-label">Archivo Excel (.xlsx, .xls)</label>
          <input
            className="form-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
          />
        </div>

        <div className="bulk-template-hint">
          Columnas esperadas: <strong>Nombre</strong>, <strong>Batido Verde</strong>, <strong>Antioxidante</strong>, <strong>Boost Inmune</strong>.
          Opcionales: <strong>Ubicacion</strong>, <strong>Notas</strong>.
        </div>

        {error && <div className="warning-banner">{error}</div>}

        {rows.length > 0 && (
          <>
            <div className="bulk-summary">
              {rows.length} pedido{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''} — {totalBags} bolsa{totalBags !== 1 ? 's' : ''} en total
            </div>

            {stockWarnings.length > 0 && (
              <div className="warning-banner">
                El stock quedara en negativo:<br />
                {stockWarnings.map((e, i) => <span key={i}>{e}<br /></span>)}
              </div>
            )}

            <div className="orders-table-wrap" style={{ marginBottom: 16 }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Ubicacion</th>
                    {FLAVORS.map(f => <th key={f.id}>{f.emoji} {f.name}</th>)}
                    <th>Total</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="order-row">
                      <td className="cell-customer">{r.customer}</td>
                      <td className="cell-muted">{r.location || '—'}</td>
                      {FLAVORS.map(f => (
                        <td key={f.id} className="cell-bags">{r.quantities[f.id]}</td>
                      ))}
                      <td className="cell-bags">{r.totalBags}</td>
                      <td className="cell-muted cell-notes">{r.notes || '—'}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => removeRow(i)}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Creando pedidos...' : `Confirmar ${rows.length} Pedido${rows.length !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── Orders List ─────────────────────────────────────────────────────────────
function OrdersList({ orders, onDelete, onEdit }) {
  const [view, setView] = useState('cards');

  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Pedidos</h1>
            <p className="page-subtitle">{orders.length} pedido{orders.length !== 1 ? 's' : ''} en total</p>
          </div>
          {orders.length > 0 && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn${view === 'cards' ? ' active' : ''}`}
                onClick={() => setView('cards')}
                title="Vista de tarjetas"
              >▦</button>
              <button
                className={`view-toggle-btn${view === 'table' ? ' active' : ''}`}
                onClick={() => setView('table')}
                title="Vista de tabla"
              >☰</button>
            </div>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">Aun no hay pedidos.</div>
        </div>
      ) : view === 'cards' ? (
        <div className="board">
          {STATUSES.map(s => {
            const col = orders.filter(o => (o.status || 'pendiente') === s.id);
            return (
              <div key={s.id} className="board-column">
                <div className={`board-column-header ${s.cssClass}`}>
                  <span className="board-column-title">{s.label}</span>
                  <span className="board-column-count">{col.length}</span>
                </div>
                <div className="board-column-body">
                  {col.length === 0 ? (
                    <div className="board-empty">Sin pedidos</div>
                  ) : (
                    col.map(o => (
                      <OrderCard key={o._id || o.id} order={o} onDelete={onDelete} onEdit={onEdit} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ubicacion</th>
                <th>Sabores</th>
                <th>Bolsas</th>
                <th>Estado</th>
                <th>Notas</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <OrderRow key={o._id || o.id} order={o} onDelete={onDelete} onEdit={onEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Status Select ──────────────────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = STATUSES.find(s => s.id === value) || STATUSES[0];
  const ref = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="status-dropdown" ref={ref}>
      <button
        className={`status-badge clickable ${current.cssClass}`}
        onClick={() => setOpen(o => !o)}
      >{current.label}</button>
      {open && (
        <div className="status-menu">
          {STATUSES.map(s => (
            <button
              key={s.id}
              className={`status-menu-item ${s.cssClass}${s.id === current.id ? ' active' : ''}`}
              onClick={() => { onChange(s.id); setOpen(false); }}
            >{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Order Row (table view) ─────────────────────────────────────────────────
function OrderRow({ order, onDelete, onEdit }) {
  const [editing, setEditing]   = useState(false);
  const [customer, setCustomer] = useState(order.customer);
  const [location, setLocation] = useState(order.location || '');
  const [notes, setNotes]       = useState(order.notes || '');

  const d = new Date(order.date);
  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async () => {
    if (!customer.trim()) return;
    await onEdit(order._id, {
      customer: customer.trim(),
      location: location.trim(),
      notes: notes.trim(),
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setCustomer(order.customer);
    setLocation(order.location || '');
    setNotes(order.notes || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="order-row editing">
        <td><input className="table-inline-input" value={customer} onChange={e => setCustomer(e.target.value)} /></td>
        <td><input className="table-inline-input" placeholder="Ubicacion" value={location} onChange={e => setLocation(e.target.value)} /></td>
        <td colSpan="2">
          {FLAVORS.map(f =>
            order.quantities[f.id] > 0 ? (
              <span key={f.id} className={`order-flavor-badge ${f.cssClass}`}>
                {f.emoji} {f.name} x{order.quantities[f.id]}
              </span>
            ) : null
          )}
        </td>
        <td><StatusSelect value={order.status} onChange={s => onEdit(order._id, { status: s })} /></td>
        <td><input className="table-inline-input" placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} /></td>
        <td>{dateStr}</td>
        <td>
          <div className="order-actions">
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
            <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="order-row">
      <td className="cell-customer">{order.customer}</td>
      <td className="cell-muted">{order.location || '—'}</td>
      <td>
        <div className="order-flavors-summary">
          {FLAVORS.map(f =>
            order.quantities[f.id] > 0 ? (
              <span key={f.id} className={`order-flavor-badge ${f.cssClass}`}>
                {f.emoji} {f.name} x{order.quantities[f.id]}
              </span>
            ) : null
          )}
        </div>
      </td>
      <td className="cell-bags">{order.totalBags}</td>
      <td>
        {onEdit
          ? <StatusSelect value={order.status} onChange={s => onEdit(order._id, { status: s })} />
          : <span className={`status-badge ${(STATUSES.find(s => s.id === order.status) || STATUSES[0]).cssClass}`}>{(STATUSES.find(s => s.id === order.status) || STATUSES[0]).label}</span>
        }
      </td>
      <td className="cell-muted cell-notes">{order.notes || '—'}</td>
      <td className="cell-muted">{dateStr}</td>
      <td>
        <div className="order-actions">
          {onEdit && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Editar</button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(order._id)}>Eliminar</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Order Card (shared) ─────────────────────────────────────────────────────
function OrderCard({ order, onDelete, onEdit }) {
  const [editing, setEditing]       = useState(false);
  const [customer, setCustomer]     = useState(order.customer);
  const [location, setLocation]     = useState(order.location || '');
  const [notes, setNotes]           = useState(order.notes || '');

  const d = new Date(order.date);
  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async () => {
    if (!customer.trim()) return;
    await onEdit(order._id, {
      customer: customer.trim(),
      location: location.trim(),
      notes: notes.trim(),
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setCustomer(order.customer);
    setLocation(order.location || '');
    setNotes(order.notes || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="order-item editing">
        <div className="edit-form-group">
          <label className="form-label">Nombre del Cliente *</label>
          <input
            className="form-input"
            value={customer}
            onChange={e => setCustomer(e.target.value)}
          />
        </div>
        <div className="edit-form-group">
          <label className="form-label">Ubicacion</label>
          <input
            className="form-input"
            placeholder="ej. Calle 5, Edificio Sol, Apto 3B"
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>
        <div className="edit-form-group">
          <label className="form-label">Notas</label>
          <textarea
            className="form-textarea"
            placeholder="ej. entregar el viernes, pagado por adelantado"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        <div className="edit-actions">
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Guardar</button>
          <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-item">
      <div className="order-item-header">
        <div className="order-header-left">
          <span className="order-customer">{order.customer}</span>
          {order.location && <span className="order-location">{order.location}</span>}
        </div>
        <div className="order-header-right">
          {onEdit
            ? <StatusSelect value={order.status} onChange={s => onEdit(order._id, { status: s })} />
            : <span className={`status-badge ${(STATUSES.find(s => s.id === order.status) || STATUSES[0]).cssClass}`}>{(STATUSES.find(s => s.id === order.status) || STATUSES[0]).label}</span>
          }
          <span className="order-date">{dateStr}</span>
        </div>
      </div>
      <div className="order-body">
        <div className="order-flavors-summary">
          {FLAVORS.map(f =>
            order.quantities[f.id] > 0 ? (
              <span key={f.id} className={`order-flavor-badge ${f.cssClass}`}>
                {f.emoji} {f.name} x{order.quantities[f.id]}
              </span>
            ) : null
          )}
        </div>
        {order.notes && <div className="order-notes">"{order.notes}"</div>}
      </div>
      <div className="order-card-footer">
        <span className="order-bag-count">{order.totalBags} bolsa{order.totalBags !== 1 ? 's' : ''}</span>
        <div className="order-actions">
          {onEdit && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              Editar
            </button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(order._id)}>
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
