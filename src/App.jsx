import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase';
import {
  collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { LayoutGrid, List, Minus, Plus, Upload } from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────
const FLAVORS = [
  { id: 'verde',        name: 'Batido Verde',  emoji: '🥬', variant: 'verde' },
  { id: 'antioxidante', name: 'Antioxidante',  emoji: '🫐', variant: 'antioxidante' },
  { id: 'boost',        name: 'Boost Inmune',  emoji: '🧡', variant: 'boost' },
];

const FLAVOR_COLORS = {
  verde: 'bg-verde',
  antioxidante: 'bg-antioxidante',
  boost: 'bg-boost',
};

const DEFAULT_STOCK = { verde: 0, antioxidante: 0, boost: 0 };

const STATUSES = [
  { id: 'pendiente',  label: 'Pendiente',  variant: 'pendiente',  color: 'text-status-pendiente' },
  { id: 'preparando', label: 'Preparando', variant: 'preparando', color: 'text-status-preparando' },
  { id: 'entregado',  label: 'Entregado',  variant: 'entregado',  color: 'text-status-entregado' },
  { id: 'pagado',     label: 'Pagado',     variant: 'pagado',     color: 'text-status-pagado' },
  { id: 'cancelado',  label: 'Cancelado',  variant: 'cancelado',  color: 'text-status-cancelado' },
];

function Label({ children, className }) {
  return <label className={cn('block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2', className)}>{children}</label>;
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]           = useState('dashboard');
  const [stock, setStock]         = useState(DEFAULT_STOCK);
  const [orders, setOrders]       = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading]     = useState(true);

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
      verde: stock.verde - order.quantities.verde,
      antioxidante: stock.antioxidante - order.quantities.antioxidante,
      boost: stock.boost - order.quantities.boost,
    };
    await setDoc(doc(db, 'config', 'stock'), newStock);
    await addDoc(collection(db, 'orders'), order);
    setPage('orders');
  }, [stock]);

  const deleteOrder = useCallback(async (id) => { await deleteDoc(doc(db, 'orders', id)); }, []);
  const editOrder = useCallback(async (id, updates) => { await updateDoc(doc(db, 'orders', id), updates); }, []);

  const bulkPlaceOrders = useCallback(async (ordersList) => {
    let newStock = { ...stock };
    const batch = writeBatch(db);
    for (const order of ordersList) {
      newStock.verde -= order.quantities.verde;
      newStock.antioxidante -= order.quantities.antioxidante;
      newStock.boost -= order.quantities.boost;
      batch.set(doc(collection(db, 'orders')), order);
    }
    batch.set(doc(db, 'config', 'stock'), newStock);
    await batch.commit();
    setPage('orders');
  }, [stock]);

  const navigate = (p) => { setPage(p); setMobileOpen(false); };

  const NAV = [
    { key: 'dashboard',  label: 'Inicio',        icon: '📊' },
    { key: 'neworder',   label: 'Nuevo Pedido',   icon: '➕' },
    { key: 'bulk',       label: 'Carga Masiva',   icon: '📄' },
    { key: 'inventory',  label: 'Inventario',     icon: '📦' },
    { key: 'orders',     label: 'Pedidos',        icon: '📋' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
      <button
        className="fixed top-3 left-3 z-[200] flex items-center justify-center w-10 h-10 rounded-lg bg-foreground text-white border-none text-lg cursor-pointer md:hidden"
        onClick={() => setMobileOpen(o => !o)}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-screen bg-foreground text-white flex flex-col z-[100] transition-all duration-300 overflow-hidden',
        'w-16 md:w-60',
        mobileOpen && 'w-60'
      )}>
        <div className="p-5 border-b border-white/10">
          <div className="font-heading font-extrabold text-2xl text-primary whitespace-nowrap">Frizo</div>
          <div className={cn('text-[0.7rem] text-white/40 mt-0.5 whitespace-nowrap transition-opacity', !mobileOpen && 'opacity-0 md:opacity-100')}>Bolsas de Smoothie</div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map(n => (
            <button
              key={n.key}
              onClick={() => navigate(n.key)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/55 hover:text-white hover:bg-white/5 transition-all border-none bg-transparent w-full text-left cursor-pointer whitespace-nowrap',
                page === n.key && 'text-white bg-primary/15',
              )}
            >
              <span className="text-lg w-6 text-center shrink-0">{n.icon}</span>
              <span className={cn('transition-opacity', !mobileOpen && 'opacity-0 w-0 overflow-hidden md:opacity-100 md:w-auto')}>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 whitespace-nowrap">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="font-heading font-extrabold text-base text-primary">{totalStock}</span>
            <span className={cn(!mobileOpen && 'opacity-0 md:opacity-100')}>bolsas en stock</span>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-[99] md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="ml-16 md:ml-60 flex-1 p-6 md:p-10 pt-16 md:pt-10 min-h-screen transition-all">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">⏳</div>
            <div>Cargando...</div>
          </div>
        ) : (
          <div key={page} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {page === 'dashboard' && <Dashboard stock={stock} orders={orders} navigate={navigate} />}
            {page === 'inventory' && <Inventory stock={stock} setStock={setStock} />}
            {page === 'neworder'  && <NewOrder stock={stock} onPlace={placeOrder} />}
            {page === 'bulk'      && <BulkUpload stock={stock} onPlace={bulkPlaceOrders} />}
            {page === 'orders'    && <OrdersList orders={orders} onDelete={deleteOrder} onEdit={editOrder} />}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Page Header ────────────────────────────────────────────────────────────
function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Flavor Card ────────────────────────────────────────────────────────────
function FlavorCard({ flavor, value, max, children }) {
  const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  return (
    <Card className="relative overflow-hidden">
      <div className={cn('absolute top-0 left-0 w-full h-1', FLAVOR_COLORS[flavor.id])} />
      <CardContent className="pt-6">
        <div className="text-3xl mb-2">{flavor.emoji}</div>
        <div className="font-heading font-extrabold text-sm mb-3">{flavor.name}</div>
        <div className={cn('font-heading font-extrabold text-4xl leading-none mb-1', `text-${flavor.id}`)}>
          {value}
        </div>
        <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground mb-3">bolsas</div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-3">
          <div className={cn('h-full rounded-full transition-all', FLAVOR_COLORS[flavor.id])} style={{ width: `${pct}%` }} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard({ stock, orders, navigate }) {
  const totalStock = stock.verde + stock.antioxidante + stock.boost;
  const totalBagsSold = orders.reduce((s, o) => s + o.totalBags, 0);
  const maxStock = Math.max(totalStock, 1);
  const recent = orders.slice(0, 5);

  return (
    <>
      <PageHeader title="Inicio" subtitle="Resumen de tu negocio de smoothies" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Pedidos Totales', value: orders.length },
          { label: 'Bolsas Vendidas', value: totalBagsSold },
          { label: 'En Stock', value: totalStock, accent: true },
        ].map(s => (
          <Card key={s.label} className="text-center p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{s.label}</div>
            <div className={cn('font-heading font-extrabold text-4xl', s.accent && 'text-primary')}>{s.value}</div>
          </Card>
        ))}
      </div>

      <h2 className="font-heading font-extrabold text-lg mb-4">Desglose de Inventario</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {FLAVORS.map(f => (
          <FlavorCard key={f.id} flavor={f} value={stock[f.id]} max={maxStock} />
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-extrabold text-lg">Pedidos Recientes</h2>
        {orders.length > 5 && (
          <Button size="sm" onClick={() => navigate('orders')}>Ver Todos</Button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-3">🥤</div>
          <div>Aun no hay pedidos. Crea tu primer pedido!</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recent.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </>
  );
}

// ─── Inventory ──────────────────────────────────────────────────────────────
function Inventory({ stock, setStock }) {
  const [draft, setDraft] = useState({ ...stock });
  const [saved, setSaved] = useState(false);
  const maxStock = Math.max(draft.verde + draft.antioxidante + draft.boost, 1);

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
      <PageHeader title="Inventario" subtitle="Administra el stock de tus bolsas de smoothie" />

      {saved && (
        <div className="bg-primary/10 border border-primary/30 text-status-pagado rounded-lg px-4 py-3 text-sm font-medium mb-4 animate-in fade-in duration-300">
          Inventario guardado exitosamente!
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        {FLAVORS.map(f => (
          <FlavorCard key={f.id} flavor={f} value={draft[f.id]} max={maxStock}>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => update(f.id, draft[f.id] - 1)}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number" min="0" value={draft[f.id]}
                onChange={e => update(f.id, e.target.value)}
                className="w-20 text-center font-heading font-extrabold text-lg"
              />
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => update(f.id, draft[f.id] + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </FlavorCard>
        ))}
      </div>

      <Button onClick={save} className="w-full sm:w-auto">💾 Guardar Inventario</Button>
    </>
  );
}

// ─── New Order ──────────────────────────────────────────────────────────────
function NewOrder({ stock, onPlace }) {
  const [customer, setCustomer] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes]       = useState('');
  const [quantities, setQuantities] = useState({ verde: 0, antioxidante: 0, boost: 0 });
  const [errors, setErrors] = useState({});

  const totalBags = quantities.verde + quantities.antioxidante + quantities.boost;
  const stockWarnings = FLAVORS.filter(f => quantities[f.id] > stock[f.id]);

  const updateQty = (id, val) => {
    const n = Math.max(0, typeof val === 'string' ? (parseInt(val, 10) || 0) : val);
    setQuantities(q => ({ ...q, [id]: n }));
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!customer.trim()) errs.customer = 'El nombre del cliente es obligatorio';
    if (totalBags === 0) errs.total = 'Agrega al menos 1 bolsa';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onPlace({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      customer: customer.trim(), location: location.trim(), notes: notes.trim(),
      quantities: { ...quantities }, totalBags, status: 'pendiente',
      date: new Date().toISOString(),
    });
  };

  return (
    <>
      <PageHeader title="Nuevo Pedido" subtitle="Crea un nuevo pedido de bolsas de smoothie" />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label>Nombre del Cliente *</Label>
              <Input placeholder="ej. María López" value={customer}
                onChange={e => { setCustomer(e.target.value); setErrors(er => ({ ...er, customer: undefined })); }} />
              {errors.customer && <p className="text-destructive text-xs mt-1">{errors.customer}</p>}
            </div>

            <div>
              <Label>Ubicacion / Direccion de Entrega</Label>
              <Input placeholder="ej. Calle 5, Edificio Sol, Apto 3B" value={location} onChange={e => setLocation(e.target.value)} />
            </div>

            <div>
              <Label>Cantidades por sabor</Label>
              {stockWarnings.length > 0 && (
                <div className="bg-destructive/8 border border-destructive/25 text-destructive rounded-lg px-4 py-3 text-sm font-medium mb-3">
                  El stock quedara en negativo para: {stockWarnings.map(f => f.name).join(', ')}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FLAVORS.map(f => (
                  <div key={f.id} className="bg-secondary rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{f.emoji}</span>
                      <span className="font-heading font-extrabold text-sm">{f.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">{stock[f.id]} en stock</div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(f.id, quantities[f.id] - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input type="number" min="0" value={quantities[f.id]}
                        onChange={e => updateQty(f.id, e.target.value)}
                        className="w-16 text-center font-heading font-extrabold" />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(f.id, quantities[f.id] + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {quantities[f.id] > stock[f.id] && (
                      <p className="text-destructive text-xs mt-2">Stock quedara en {stock[f.id] - quantities[f.id]}</p>
                    )}
                  </div>
                ))}
              </div>
              {errors.total && <p className="text-destructive text-xs mt-2">{errors.total}</p>}
            </div>

            <div>
              <Label>Notas (opcional)</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors min-h-[80px] resize-y"
                placeholder="ej. entregar el viernes, pagado por adelantado"
                value={notes} onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="font-semibold text-muted-foreground">Total de bolsas</span>
              <span className="font-heading font-extrabold text-2xl text-primary">{totalBags}</span>
            </div>

            <Button type="submit" className="w-full">Confirmar Pedido</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Bulk Upload ────────────────────────────────────────────────────────────
function BulkUpload({ stock, onPlace }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const COLUMN_MAP = {
    'nombre': 'customer', 'batido verde': 'verde', 'antioxidante': 'antioxidante',
    'boost inmune': 'boost', 'ubicacion': 'location', 'ubicación': 'location', 'notas': 'notes',
  };

  const handleFile = (e) => {
    setError(''); setRows([]);
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
        for (const h of headers) { const key = h.trim().toLowerCase(); if (COLUMN_MAP[key]) colMap[h] = COLUMN_MAP[key]; }
        if (!Object.values(colMap).includes('customer')) { setError('No se encontro la columna "Nombre".'); return; }
        const parsed = json.map(row => {
          const customer = String(row[headers.find(h => colMap[h] === 'customer')] || '').trim();
          const verde = parseInt(row[headers.find(h => colMap[h] === 'verde')] || 0, 10) || 0;
          const antioxidante = parseInt(row[headers.find(h => colMap[h] === 'antioxidante')] || 0, 10) || 0;
          const boost = parseInt(row[headers.find(h => colMap[h] === 'boost')] || 0, 10) || 0;
          const location = String(row[headers.find(h => colMap[h] === 'location')] || '').trim();
          const notes = String(row[headers.find(h => colMap[h] === 'notes')] || '').trim();
          return { customer, quantities: { verde, antioxidante, boost }, totalBags: verde + antioxidante + boost, location, notes };
        }).filter(r => r.customer && r.totalBags > 0);
        if (parsed.length === 0) { setError('No se encontraron pedidos validos en el archivo.'); return; }
        setRows(parsed);
      } catch { setError('No se pudo leer el archivo. Asegurate de que sea un .xlsx o .xls valido.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const totalVerde = rows.reduce((s, r) => s + r.quantities.verde, 0);
  const totalAntioxidante = rows.reduce((s, r) => s + r.quantities.antioxidante, 0);
  const totalBoost = rows.reduce((s, r) => s + r.quantities.boost, 0);
  const totalBags = rows.reduce((s, r) => s + r.totalBags, 0);

  const stockWarnings = [];
  if (totalVerde > stock.verde) stockWarnings.push(`Batido Verde: necesitas ${totalVerde}, tienes ${stock.verde} (quedara en ${stock.verde - totalVerde})`);
  if (totalAntioxidante > stock.antioxidante) stockWarnings.push(`Antioxidante: necesitas ${totalAntioxidante}, tienes ${stock.antioxidante} (quedara en ${stock.antioxidante - totalAntioxidante})`);
  if (totalBoost > stock.boost) stockWarnings.push(`Boost Inmune: necesitas ${totalBoost}, tienes ${stock.boost} (quedara en ${stock.boost - totalBoost})`);

  const handleSubmit = async () => {
    setSubmitting(true);
    const orders = rows.map(r => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      customer: r.customer, location: r.location, notes: r.notes,
      quantities: r.quantities, totalBags: r.totalBags, status: 'pendiente',
      date: new Date().toISOString(),
    }));
    await onPlace(orders);
  };

  return (
    <>
      <PageHeader title="Carga Masiva" subtitle="Sube un archivo Excel para crear varios pedidos a la vez" />

      <Card className="max-w-4xl">
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Archivo Excel (.xlsx, .xls)</Label>
            <Input type="file" accept=".xlsx,.xls" onChange={handleFile} />
          </div>

          <div className="bg-secondary rounded-lg px-4 py-3 text-sm text-muted-foreground leading-relaxed">
            Columnas esperadas: <strong>Nombre</strong>, <strong>Batido Verde</strong>, <strong>Antioxidante</strong>, <strong>Boost Inmune</strong>.
            Opcionales: <strong>Ubicacion</strong>, <strong>Notas</strong>.
          </div>

          {error && <div className="bg-destructive/8 border border-destructive/25 text-destructive rounded-lg px-4 py-3 text-sm font-medium">{error}</div>}

          {rows.length > 0 && (
            <>
              <p className="font-semibold">
                {rows.length} pedido{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''} — {totalBags} bolsa{totalBags !== 1 ? 's' : ''} en total
              </p>

              {stockWarnings.length > 0 && (
                <div className="bg-destructive/8 border border-destructive/25 text-destructive rounded-lg px-4 py-3 text-sm font-medium">
                  El stock quedara en negativo:<br />
                  {stockWarnings.map((e, i) => <span key={i}>{e}<br /></span>)}
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ubicacion</TableHead>
                    {FLAVORS.map(f => <TableHead key={f.id}>{f.emoji} {f.name}</TableHead>)}
                    <TableHead>Total</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold whitespace-nowrap">{r.customer}</TableCell>
                      <TableCell className="text-muted-foreground">{r.location || '—'}</TableCell>
                      {FLAVORS.map(f => <TableCell key={f.id} className="font-heading font-extrabold text-center text-primary">{r.quantities[f.id]}</TableCell>)}
                      <TableCell className="font-heading font-extrabold text-center text-primary">{r.totalBags}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] truncate">{r.notes || '—'}</TableCell>
                      <TableCell><Button variant="destructive" size="sm" onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}>Quitar</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Creando pedidos...' : `Confirmar ${rows.length} Pedido${rows.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Orders List ────────────────────────────────────────────────────────────
function OrdersList({ orders, onDelete, onEdit }) {
  const [view, setView] = useState('cards');

  return (
    <>
      <PageHeader title="Pedidos" subtitle={`${orders.length} pedido${orders.length !== 1 ? 's' : ''} en total`}>
        {orders.length > 0 && (
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('cards')} title="Vista de tarjetas"
              className={cn('w-9 h-9 flex items-center justify-center border-none cursor-pointer transition-colors', view === 'cards' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-secondary')}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('table')} title="Vista de tabla"
              className={cn('w-9 h-9 flex items-center justify-center border-none border-l border-border cursor-pointer transition-colors', view === 'table' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-secondary')}>
              <List className="h-4 w-4" />
            </button>
          </div>
        )}
      </PageHeader>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <div>Aun no hay pedidos.</div>
        </div>
      ) : view === 'cards' ? (
        <div className="flex flex-col gap-5">
          {STATUSES.map(s => {
            const col = orders.filter(o => (o.status || 'pendiente') === s.id);
            return (
              <div key={s.id} className="bg-secondary rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className={cn('font-heading font-extrabold text-sm uppercase tracking-wide', s.color)}>{s.label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-foreground/5">{col.length}</span>
                </div>
                <div className="p-3">
                  {col.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-5">Sin pedidos</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {col.map(o => <OrderCard key={o._id || o.id} order={o} onDelete={onDelete} onEdit={onEdit} />)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Ubicacion</TableHead>
              <TableHead>Sabores</TableHead>
              <TableHead>Bolsas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(o => <OrderRow key={o._id || o.id} order={o} onDelete={onDelete} onEdit={onEdit} />)}
          </TableBody>
        </Table>
      )}
    </>
  );
}

// ─── Status Select ──────────────────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = STATUSES.find(s => s.id === value) || STATUSES[0];
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <Badge variant={current.variant} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setOpen(o => !o)}>
        {current.label}
      </Badge>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 flex flex-col gap-0.5 min-w-[120px]">
          {STATUSES.map(s => (
            <button key={s.id}
              className={cn('border-none bg-transparent text-left px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors hover:opacity-80', s.color, s.id === current.id && 'font-extrabold')}
              onClick={() => { onChange(s.id); setOpen(false); }}
            >{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Order Row ──────────────────────────────────────────────────────────────
function OrderRow({ order, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(order.customer);
  const [location, setLocation] = useState(order.location || '');
  const [notes, setNotes] = useState(order.notes || '');

  const d = new Date(order.date);
  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async () => {
    if (!customer.trim()) return;
    await onEdit(order._id, { customer: customer.trim(), location: location.trim(), notes: notes.trim() });
    setEditing(false);
  };
  const handleCancel = () => { setCustomer(order.customer); setLocation(order.location || ''); setNotes(order.notes || ''); setEditing(false); };

  if (editing) {
    return (
      <TableRow className="bg-primary/5">
        <TableCell><Input value={customer} onChange={e => setCustomer(e.target.value)} className="h-8 text-xs" /></TableCell>
        <TableCell><Input placeholder="Ubicacion" value={location} onChange={e => setLocation(e.target.value)} className="h-8 text-xs" /></TableCell>
        <TableCell colSpan={2}>
          <div className="flex gap-1 flex-wrap">
            {FLAVORS.map(f => order.quantities[f.id] > 0 ? <Badge key={f.id} variant={f.variant}>{f.emoji} {f.name} x{order.quantities[f.id]}</Badge> : null)}
          </div>
        </TableCell>
        <TableCell><StatusSelect value={order.status} onChange={s => onEdit(order._id, { status: s })} /></TableCell>
        <TableCell><Input placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-xs" /></TableCell>
        <TableCell className="text-muted-foreground text-xs">{dateStr}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave}>Guardar</Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>Cancelar</Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-semibold whitespace-nowrap">{order.customer}</TableCell>
      <TableCell className="text-muted-foreground">{order.location || '—'}</TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {FLAVORS.map(f => order.quantities[f.id] > 0 ? <Badge key={f.id} variant={f.variant}>{f.emoji} {f.name} x{order.quantities[f.id]}</Badge> : null)}
        </div>
      </TableCell>
      <TableCell className="font-heading font-extrabold text-primary text-center">{order.totalBags}</TableCell>
      <TableCell>
        {onEdit ? <StatusSelect value={order.status} onChange={s => onEdit(order._id, { status: s })} />
          : <Badge variant={(STATUSES.find(s => s.id === order.status) || STATUSES[0]).variant}>{(STATUSES.find(s => s.id === order.status) || STATUSES[0]).label}</Badge>}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[180px] truncate">{order.notes || '—'}</TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{dateStr}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {onEdit && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
          {onDelete && <Button variant="destructive" size="sm" onClick={() => onDelete(order._id)}>Eliminar</Button>}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Order Card ─────────────────────────────────────────────────────────────
function OrderCard({ order, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(order.customer);
  const [location, setLocation] = useState(order.location || '');
  const [notes, setNotes] = useState(order.notes || '');

  const d = new Date(order.date);
  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async () => {
    if (!customer.trim()) return;
    await onEdit(order._id, { customer: customer.trim(), location: location.trim(), notes: notes.trim() });
    setEditing(false);
  };
  const handleCancel = () => { setCustomer(order.customer); setLocation(order.location || ''); setNotes(order.notes || ''); setEditing(false); };

  if (editing) {
    return (
      <Card className="border-primary shadow-[0_0_0_2px_rgba(160,205,50,0.2)]">
        <CardContent className="pt-5 space-y-3">
          <div>
            <Label>Nombre del Cliente *</Label>
            <Input value={customer} onChange={e => setCustomer(e.target.value)} />
          </div>
          <div>
            <Label>Ubicacion</Label>
            <Input placeholder="ej. Calle 5, Edificio Sol, Apto 3B" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div>
            <Label>Notas</Label>
            <textarea className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary"
              placeholder="ej. entregar el viernes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>Guardar</Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="pt-4 pb-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-heading font-extrabold text-sm truncate">{order.customer}</div>
            {order.location && <div className="text-[0.7rem] text-muted-foreground truncate">📍 {order.location}</div>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {onEdit
              ? <StatusSelect value={order.status} onChange={s => onEdit(order._id, { status: s })} />
              : <Badge variant={(STATUSES.find(s => s.id === order.status) || STATUSES[0]).variant}>{(STATUSES.find(s => s.id === order.status) || STATUSES[0]).label}</Badge>}
            <span className="text-[0.65rem] text-muted-foreground whitespace-nowrap">{dateStr}</span>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {FLAVORS.map(f => order.quantities[f.id] > 0 ? <Badge key={f.id} variant={f.variant}>{f.emoji} {f.name} x{order.quantities[f.id]}</Badge> : null)}
        </div>
        {order.notes && <p className="text-xs text-muted-foreground italic truncate">"{order.notes}"</p>}
      </CardContent>
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-between px-5 py-2 border-t border-border">
          <span className="font-heading font-extrabold text-xs text-primary">{order.totalBags} bolsa{order.totalBags !== 1 ? 's' : ''}</span>
          <div className="flex gap-1">
            {onEdit && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
            {onDelete && <Button variant="destructive" size="sm" onClick={() => onDelete(order._id)}>Eliminar</Button>}
          </div>
        </div>
      )}
    </Card>
  );
}
