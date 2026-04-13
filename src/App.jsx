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
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from '@/components/app-sidebar';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { LayoutGrid, List, Minus, Plus, Upload, MapPin, CheckSquare, Square } from 'lucide-react';

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

// ─── Places Autocomplete ────────────────────────────────────────────────────
function PlacesAutocomplete({ value, onChange, onSelect, placeholder, className }) {
  const containerRef = useRef(null);
  const elementRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(!!window.google?.maps?.places?.PlaceAutocompleteElement);

  useEffect(() => {
    if (window.google?.maps?.places?.PlaceAutocompleteElement) { setReady(true); return; }
    const interval = setInterval(() => {
      if (window.google?.maps?.places?.PlaceAutocompleteElement) { setReady(true); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || elementRef.current) return;

    const el = new window.google.maps.places.PlaceAutocompleteElement({});
    el.includedRegionCodes = ['cr'];
    elementRef.current = el;

    el.addEventListener('gmp-select', async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
      onSelectRef.current(
        place.formattedAddress,
        place.location.lat(),
        place.location.lng()
      );
    });

    containerRef.current.appendChild(el);

    return () => {
      if (elementRef.current && elementRef.current.parentNode) {
        elementRef.current.parentNode.removeChild(elementRef.current);
      }
      elementRef.current = null;
    };
  }, [ready]);

  return (
    <div className={cn('places-autocomplete-wrap', className)}>
      {value && !ready && (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none placeholder:text-muted-foreground md:text-sm"
        />
      )}
      <div ref={containerRef} />
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]           = useState('dashboard');
  const [stock, setStock]         = useState(DEFAULT_STOCK);
  const [orders, setOrders]       = useState([]);
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

  const navigate = (p) => { setPage(p); };

  return (
    <SidebarProvider>
      <AppSidebar page={page} onNavigate={navigate} totalStock={totalStock} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            {({ dashboard: 'Inicio', neworder: 'Nuevo Pedido', bulk: 'Carga Masiva', inventory: 'Inventario', orders: 'Pedidos', routes: 'Rutas', settings: 'Configuracion' })[page]}
          </span>
        </header>
        <main className="flex-1 p-6 md:p-8">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">⏳</div>
              <div>Cargando...</div>
            </div>
          ) : (
            <div key={page}>
              {page === 'dashboard' && <Dashboard stock={stock} orders={orders} navigate={navigate} />}
              {page === 'inventory' && <Inventory stock={stock} setStock={setStock} />}
              {page === 'neworder'  && <NewOrder stock={stock} onPlace={placeOrder} />}
              {page === 'bulk'      && <BulkUpload stock={stock} onPlace={bulkPlaceOrders} />}
              {page === 'orders'    && <OrdersList orders={orders} onDelete={deleteOrder} onEdit={editOrder} />}
              {page === 'routes'    && <RoutePlanner orders={orders} />}
              {page === 'settings'  && <Settings />}
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
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
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
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
      lat, lng,
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
              <PlacesAutocomplete
                value={location}
                onChange={setLocation}
                onSelect={(addr, newLat, newLng) => { setLocation(addr); setLat(newLat); setLng(newLng); }}
                placeholder="ej. Calle 5, Edificio Sol, Apto 3B"
              />
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

// ─── Settings ───────────────────────────────────────────────────────────────
function Settings() {
  const [factoryAddress, setFactoryAddress] = useState('Iglesia Santa Catalina de Alejandría');
  const [factoryLat, setFactoryLat] = useState(null);
  const [factoryLng, setFactoryLng] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.factoryAddress) setFactoryAddress(data.factoryAddress);
        if (data.factoryLat) setFactoryLat(data.factoryLat);
        if (data.factoryLng) setFactoryLng(data.factoryLng);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const save = async () => {
    await setDoc(doc(db, 'config', 'settings'), { factoryAddress, factoryLat, factoryLng });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Cargando...</div>;

  return (
    <>
      <PageHeader title="Configuracion" subtitle="Configura la direccion de la fabrica y otros ajustes" />
      {saved && (
        <div className="bg-primary/10 border border-primary/30 text-status-pagado rounded-lg px-4 py-3 text-sm font-medium mb-4">
          Configuracion guardada exitosamente!
        </div>
      )}
      <Card className="max-w-2xl">
        <CardContent className="pt-6 space-y-5">
          <div>
            <Label>Direccion de la Fabrica (punto de partida para rutas)</Label>
            <PlacesAutocomplete
              value={factoryAddress}
              onChange={setFactoryAddress}
              onSelect={(addr, lat, lng) => { setFactoryAddress(addr); setFactoryLat(lat); setFactoryLng(lng); }}
              placeholder="ej. Iglesia Santa Catalina de Alejandría"
            />
            {factoryLat && factoryLng && (
              <p className="text-xs text-muted-foreground mt-1">Coordenadas: {factoryLat.toFixed(6)}, {factoryLng.toFixed(6)}</p>
            )}
          </div>
          <Button onClick={save}>Guardar Configuracion</Button>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Route Planner ──────────────────────────────────────────────────────────
function RoutePlanner({ orders }) {
  const [settings, setSettings] = useState(null);
  const [statusFilter, setStatusFilter] = useState(['pendiente', 'preparando']);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [directions, setDirections] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return unsub;
  }, []);

  const eligibleOrders = orders.filter(o =>
    statusFilter.includes(o.status || 'pendiente') && o.lat && o.lng
  );
  const ordersWithoutCoords = orders.filter(o =>
    statusFilter.includes(o.status || 'pendiente') && (!o.lat || !o.lng)
  );

  const toggleOrder = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === eligibleOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleOrders.map(o => o._id)));
    }
  };

  const toggleStatus = (statusId) => {
    setStatusFilter(prev =>
      prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]
    );
    setSelectedIds(new Set());
    setDirections(null);
  };

  const calculateRoute = () => {
    const selected = orders.filter(o => selectedIds.has(o._id));
    if (selected.length === 0) { setError('Selecciona al menos un pedido.'); return; }
    if (selected.length > 23) { setError('Maximo 23 paradas por ruta (limite de Google Maps).'); return; }
    if (!settings?.factoryLat || !settings?.factoryLng) { setError('Configura la direccion de la fabrica en Configuracion.'); return; }
    setError('');
    setCalculating(true);

    const directionsService = new window.google.maps.DirectionsService();
    const origin = { lat: settings.factoryLat, lng: settings.factoryLng };

    const request = selected.length === 1
      ? { origin, destination: { lat: selected[0].lat, lng: selected[0].lng }, travelMode: 'DRIVING' }
      : {
          origin,
          destination: origin,
          waypoints: selected.map(o => ({ location: { lat: o.lat, lng: o.lng }, stopover: true })),
          optimizeWaypoints: true,
          travelMode: 'DRIVING',
        };

    directionsService.route(request, (result, status) => {
      if (status === 'OK') { setDirections(result); }
      else { setError('Error calculando la ruta: ' + status); }
      setCalculating(false);
    });
  };

  const getOptimizedStops = () => {
    if (!directions) return [];
    const selected = orders.filter(o => selectedIds.has(o._id));
    if (selected.length === 1) {
      return [{ order: selected[0], leg: directions.routes[0].legs[0], stopNumber: 1 }];
    }
    const waypointOrder = directions.routes[0].waypoint_order;
    return waypointOrder.map((idx, i) => ({
      order: selected[idx],
      leg: directions.routes[0].legs[i],
      stopNumber: i + 1,
    }));
  };

  const totalDuration = directions
    ? directions.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0)
    : 0;
  const totalDistance = directions
    ? directions.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0)
    : 0;

  const mapCenter = settings?.factoryLat
    ? { lat: settings.factoryLat, lng: settings.factoryLng }
    : { lat: 8.9824, lng: -79.5199 };

  return (
    <>
      <PageHeader title="Rutas" subtitle="Planifica rutas de entrega optimizadas desde la fabrica" />

      {!settings?.factoryLat && (
        <div className="bg-destructive/8 border border-destructive/25 text-destructive rounded-lg px-4 py-3 text-sm font-medium mb-4">
          Configura la direccion de la fabrica en Configuracion antes de planificar rutas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: filters + order selection */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <Label>Filtrar por estado</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map(s => (
                    <button key={s.id} onClick={() => toggleStatus(s.id)}
                      className={cn('border-none bg-transparent cursor-pointer transition-opacity', !statusFilter.includes(s.id) && 'opacity-40')}>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="mb-0">Pedidos ({eligibleOrders.length})</Label>
                  {eligibleOrders.length > 0 && (
                    <button onClick={toggleAll} className="text-xs text-primary font-semibold border-none bg-transparent cursor-pointer">
                      {selectedIds.size === eligibleOrders.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {eligibleOrders.map(o => (
                    <button key={o._id} onClick={() => toggleOrder(o._id)}
                      className={cn('w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg border border-border text-sm cursor-pointer transition-colors bg-transparent',
                        selectedIds.has(o._id) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted')}>
                      {selectedIds.has(o._id) ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{o.customer}</div>
                        <div className="text-xs text-muted-foreground truncate">{o.location}</div>
                      </div>
                    </button>
                  ))}
                  {eligibleOrders.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No hay pedidos con coordenadas para los estados seleccionados.</p>
                  )}
                </div>
                {ordersWithoutCoords.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {ordersWithoutCoords.length} pedido{ordersWithoutCoords.length !== 1 ? 's' : ''} sin coordenadas (editalos para agregar ubicacion).
                  </p>
                )}
              </div>

              {error && <p className="text-destructive text-sm font-medium">{error}</p>}

              <Button onClick={calculateRoute} disabled={calculating || selectedIds.size === 0} className="w-full">
                {calculating ? 'Calculando...' : `Calcular Ruta (${selectedIds.size} parada${selectedIds.size !== 1 ? 's' : ''})`}
              </Button>
            </CardContent>
          </Card>

          {/* Route summary */}
          {directions && (
            <Card>
              <CardContent className="pt-5">
                <Label>Ruta optimizada</Label>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-sm">
                    <span className="font-heading font-extrabold text-primary w-6 text-center">F</span>
                    <span className="font-semibold">Fabrica</span>
                    <span className="text-xs text-muted-foreground ml-auto">Inicio</span>
                  </div>
                  {getOptimizedStops().map(stop => (
                    <div key={stop.order._id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
                      <span className="font-heading font-extrabold text-primary w-6 text-center">{stop.stopNumber}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{stop.order.customer}</div>
                        <div className="text-xs text-muted-foreground">{stop.leg.distance.text} · {stop.leg.duration.text}</div>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => selectedIds.has(o._id)).length > 1 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-sm">
                      <span className="font-heading font-extrabold text-primary w-6 text-center">F</span>
                      <span className="font-semibold">Regreso a fabrica</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {directions.routes[0].legs[directions.routes[0].legs.length - 1].distance.text} · {directions.routes[0].legs[directions.routes[0].legs.length - 1].duration.text}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                  <span>Total</span>
                  <span>{(totalDistance / 1000).toFixed(1)} km · {Math.round(totalDuration / 60)} min</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel: map */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '600px' }}
              center={mapCenter}
              zoom={12}
            >
              {directions && <DirectionsRenderer directions={directions} />}
              {!directions && settings?.factoryLat && (
                <Marker position={{ lat: settings.factoryLat, lng: settings.factoryLng }} label="F" />
              )}
            </GoogleMap>
          </Card>
        </div>
      </div>
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
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-1 min-w-[130px]">
          {STATUSES.map(s => (
            <button key={s.id}
              className={cn('border-none bg-transparent text-left px-1 py-0.5 rounded-md cursor-pointer transition-colors hover:bg-muted', s.id === current.id && 'ring-1 ring-ring/30')}
              onClick={() => { onChange(s.id); setOpen(false); }}
            >
              <Badge variant={s.variant}>{s.label}</Badge>
            </button>
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
  const [lat, setLat] = useState(order.lat || null);
  const [lng, setLng] = useState(order.lng || null);
  const [notes, setNotes] = useState(order.notes || '');

  const d = new Date(order.date);
  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async () => {
    if (!customer.trim()) return;
    await onEdit(order._id, { customer: customer.trim(), location: location.trim(), notes: notes.trim(), lat, lng });
    setEditing(false);
  };
  const handleCancel = () => { setCustomer(order.customer); setLocation(order.location || ''); setLat(order.lat || null); setLng(order.lng || null); setNotes(order.notes || ''); setEditing(false); };

  if (editing) {
    return (
      <TableRow className="bg-primary/5">
        <TableCell><Input value={customer} onChange={e => setCustomer(e.target.value)} className="h-8 text-xs" /></TableCell>
        <TableCell><PlacesAutocomplete value={location} onChange={setLocation} onSelect={(addr, newLat, newLng) => { setLocation(addr); setLat(newLat); setLng(newLng); }} placeholder="Ubicacion" className="h-8 text-xs" /></TableCell>
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
  const [lat, setLat] = useState(order.lat || null);
  const [lng, setLng] = useState(order.lng || null);
  const [notes, setNotes] = useState(order.notes || '');

  const d = new Date(order.date);
  const dateStr = d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async () => {
    if (!customer.trim()) return;
    await onEdit(order._id, { customer: customer.trim(), location: location.trim(), notes: notes.trim(), lat, lng });
    setEditing(false);
  };
  const handleCancel = () => { setCustomer(order.customer); setLocation(order.location || ''); setLat(order.lat || null); setLng(order.lng || null); setNotes(order.notes || ''); setEditing(false); };

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
            <PlacesAutocomplete
              value={location}
              onChange={setLocation}
              onSelect={(addr, newLat, newLng) => { setLocation(addr); setLat(newLat); setLng(newLng); }}
              placeholder="ej. Calle 5, Edificio Sol, Apto 3B"
            />
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
