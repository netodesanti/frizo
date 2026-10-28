import { useEffect, useState } from 'react';
import { Check, MapPin, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  DEFAULT_PRICE, NEXT_STATUS, STATUSES, statusOf, sumQty, orderTotal, flavorOf, mapsUrl,
} from '@/lib/data';
import { money, formatOrderDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Card, ListItem, Stack, Avatar, FlavorTile, StatusTag, Stepper, TextField, SelectField, Button, Sheet, useSticky,
} from '@/components/kit';
import { PlacesAutocomplete } from '@/components/places-autocomplete';

export function FlavorTag({ flavor, qty }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-semibold"
      style={{ backgroundColor: `${flavor.color}1f`, color: flavor.color }}>
      {flavor.emoji} {qty}
    </span>
  );
}

const shortDate = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });

export function OrderCard({ order, onClick, showStatus = true }) {
  const { flavors } = useStore();
  const items = Object.entries(order.quantities || {}).filter(([, q]) => q > 0);
  return (
    <ListItem onClick={onClick} leading={<Avatar name={order.customer} />} title={order.customer}
      subtitle={[`${order.totalBags} bolsa${order.totalBags !== 1 ? 's' : ''}`, order.location?.split(',')[0]].filter(Boolean).join(' · ')}
      meta={<>
        {showStatus && <StatusTag status={order.status} />}
        {items.map(([id, q]) => <FlavorTag key={id} flavor={flavorOf(flavors, id)} qty={q} />)}
      </>}
      trailing={
        <div className="shrink-0 self-start text-right">
          <div className="font-display text-[17px] font-bold tabular-nums">{money(orderTotal(order))}</div>
          <div className="text-[12px] text-muted-foreground">{shortDate(order.date)}</div>
        </div>
      } />
  );
}

// ─── Form ───────────────────────────────────────────────────────────────────
// Shared by "Nuevo pedido" and editing; `children` renders after the fields
// (e.g. a submit button). Submit it from elsewhere with <button form={id}>.
export function OrderForm({ id, initial, onSubmit, children }) {
  const { stock, flavors } = useStore();
  const [customer, setCustomer] = useState(initial?.customer || '');
  const [place, setPlace] = useState({ location: initial?.location || '', lat: initial?.lat ?? null, lng: initial?.lng ?? null });
  const [quantities, setQuantities] = useState({ ...(initial?.quantities || {}) });
  const [price, setPrice] = useState(String(initial?.pricePerBag ?? DEFAULT_PRICE));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');

  const totalBags = sumQty(quantities);
  const pricePerBag = parseInt(price, 10) || 0;
  // What's left in stock plus what this order already holds.
  const available = (fid) => (stock[fid] || 0)
    + (initial && initial.status !== 'cancelado' ? initial.quantities?.[fid] || 0 : 0);

  const submit = (e) => {
    e.preventDefault();
    if (!customer.trim()) { setError('Falta el nombre del cliente'); return; }
    if (totalBags === 0) { setError('Agregá al menos una bolsa'); return; }
    onSubmit({
      customer: customer.trim(), location: place.location.trim(), lat: place.lat, lng: place.lng,
      notes: notes.trim(), quantities, totalBags, pricePerBag, totalPrice: totalBags * pricePerBag,
    });
  };

  return (
    <form id={id} onSubmit={submit} className="space-y-6">
      <TextField label="Cliente" placeholder="¿Para quién es?" value={customer} autoComplete="off"
        onChange={e => { setCustomer(e.target.value); setError(''); }} />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#fde4ee] text-[#d63d7a]"><MapPin className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-muted-foreground">Entrega</div>
            <div className={cn('text-[15px] font-medium', !place.location && 'text-muted-foreground')}>{place.location || 'Sin dirección todavía'}</div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-muted px-3">
          <PlacesAutocomplete placeholder={place.location ? 'Buscar otra dirección' : 'Buscar dirección'}
            onSelect={(location, lat, lng) => setPlace({ location, lat, lng })} />
        </div>
      </Card>

      <div className="space-y-2.5">
        <div className="px-1 font-display text-[18px] font-bold">Productos</div>
        {flavors.map(f => {
          const q = quantities[f.id] || 0;
          const short = q > available(f.id);
          return (
            <Card key={f.id} className={cn('flex items-center gap-3 p-3 pr-3.5 transition-shadow', q > 0 && 'ring-2 ring-brand-lime')}>
              <FlavorTile flavor={f} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{f.name}</div>
                <div className={cn('text-[13px]', short ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                  {available(f.id)} en stock
                </div>
              </div>
              <Stepper value={q} onChange={v => { setQuantities(x => ({ ...x, [f.id]: Math.max(0, v) })); setError(''); }} />
            </Card>
          );
        })}
      </div>

      <Stack>
        <TextField label="Precio por bolsa (₡)" type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} />
        <TextField label="Notas" multiline placeholder="Ej. entregar el viernes" value={notes} onChange={e => setNotes(e.target.value)} />
      </Stack>

      <div className="grain flex items-end justify-between overflow-hidden rounded-[26px] bg-primary p-5 text-white">
        <div>
          <div className="text-[13px] text-white/60">Total</div>
          <div className="text-[14px] font-medium text-white/80">{totalBags} bolsa{totalBags !== 1 ? 's' : ''} × {money(pricePerBag)}</div>
        </div>
        <div className="font-display text-[34px] font-bold leading-none tracking-tight text-brand-lime tabular-nums">{money(totalBags * pricePerBag)}</div>
      </div>
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
      {children}
    </form>
  );
}

// ─── Detail sheet ───────────────────────────────────────────────────────────
const STEPS = ['pendiente', 'preparando', 'entregado', 'pagado'];

function StatusTrack({ status }) {
  if (status === 'cancelado') {
    return <div className="rounded-2xl bg-muted px-4 py-3 text-center text-[14px] font-semibold text-muted-foreground">Pedido cancelado</div>;
  }
  const at = STEPS.indexOf(status);
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full items-center">
            <span className={cn('h-1 flex-1 rounded-full', i === 0 ? 'invisible' : i <= at ? 'bg-primary' : 'bg-input')} />
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
              i < at ? 'bg-primary text-brand-lime' : i === at ? 'bg-brand-lime text-brand-green ring-4 ring-brand-lime/30' : 'bg-input text-muted-foreground')}>
              {i < at ? <Check className="size-4" strokeWidth={3} /> : <span className="text-[13px] font-bold">{i + 1}</span>}
            </span>
            <span className={cn('h-1 flex-1 rounded-full', i === STEPS.length - 1 ? 'invisible' : i < at ? 'bg-primary' : 'bg-input')} />
          </div>
          <span className={cn('text-[12px] font-semibold', i === at ? 'text-foreground' : 'text-muted-foreground')}>{statusOf(s).label}</span>
        </div>
      ))}
    </div>
  );
}

export function OrderSheet({ order, onClose, readOnly }) {
  const { allOrders, flavors, editOrder, deleteOrder } = useStore();
  const shown = useSticky(order);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (order) setEditing(false); }, [order]);

  // Follow live updates (e.g. a status change made from this sheet).
  const o = shown && (allOrders.find(x => x._id === shown._id) || shown);
  if (!o) return null;
  const status = o.status || 'pendiente';
  const next = NEXT_STATUS[status];

  const remove = () => {
    if (!window.confirm(`¿Eliminar el pedido de ${o.customer}?`)) return;
    deleteOrder(o._id);
    onClose();
  };

  return (
    <Sheet open={!!order} onOpenChange={v => !v && onClose()}
      title={editing ? 'Editar pedido' : o.customer}
      onBack={editing ? () => setEditing(false) : undefined}
      confirm={editing ? { label: 'Guardar cambios', form: 'order-edit' } : undefined}>
      {editing ? (
        <OrderForm id="order-edit" initial={o} onSubmit={data => { editOrder(o._id, data); setEditing(false); }} />
      ) : (
        <>
          <Card className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={o.customer} size={52} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[32px] font-bold leading-none tracking-tight tabular-nums">{money(orderTotal(o))}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">{o.totalBags} bolsa{o.totalBags !== 1 ? 's' : ''} · {formatOrderDate(o.date)}</div>
              </div>
              <StatusTag status={status} />
            </div>
            <StatusTrack status={status} />
          </Card>

          {!readOnly && next && (
            <Button onClick={() => editOrder(o._id, { status: next })}>Marcar como {statusOf(next).label.toLowerCase()}</Button>
          )}

          <Stack>
            {Object.entries(o.quantities || {}).filter(([, q]) => q > 0).map(([id, q]) => {
              const f = flavorOf(flavors, id);
              return (
                <ListItem key={id} leading={<FlavorTile flavor={f} />} title={f.name} subtitle={`${money(o.pricePerBag || DEFAULT_PRICE)} c/u`}
                  trailing={<span className="font-display text-[20px] font-bold">× {q}</span>} />
              );
            })}
            {o.location && <ListItem icon={MapPin} tone="blush" title={o.location} subtitle="Abrir en Google Maps" chevron onClick={() => window.open(mapsUrl(o), '_blank')} />}
            {o.notes && <ListItem icon={StickyNote} tone="butter" title={o.notes} subtitle="Notas" />}
          </Stack>

          {!readOnly && (
            <SelectField label="Cambiar estado" value={status} onChange={s => editOrder(o._id, { status: s })}
              options={STATUSES.map(s => ({ value: s.id, label: s.label }))} />
          )}

          {!readOnly && (
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil /> Editar</Button>
              <Button variant="danger" onClick={remove}><Trash2 /> Eliminar</Button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
