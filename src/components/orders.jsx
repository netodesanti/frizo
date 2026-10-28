import { useEffect, useState } from 'react';
import { MapPin, StickyNote } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  DEFAULT_PRICE, NEXT_STATUS, STATUSES, statusOf, sumQty, orderTotal, flavorOf, mapsUrl,
} from '@/lib/data';
import { money, formatOrderDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Group, Row, Cell, ButtonRow, TextField, SelectRow, Stepper, BigButton, FlavorTile,
  StatusPill, ModalSheet, useSticky, statusDotClass,
} from '@/components/ios';
import { PlacesAutocomplete } from '@/components/places-autocomplete';

export const flavorSummary = (flavors, order) => Object.entries(order.quantities || {})
  .filter(([, q]) => q > 0)
  .map(([id, q]) => `${flavorOf(flavors, id).emoji} ${q}`)
  .join('  ');

export function OrderListRow({ order, onClick, showStatus }) {
  const { flavors } = useStore();
  return (
    <Row onClick={onClick} chevron
      leading={showStatus && <span className={cn('size-2.5 shrink-0 rounded-full', statusDotClass[order.status || 'pendiente'])} />}
      title={order.customer}
      subtitle={`${flavorSummary(flavors, order)} · ${formatOrderDate(order.date)}`}
      detail={money(orderTotal(order))} />
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
      <Group>
        <TextField placeholder="Nombre del cliente" value={customer} autoComplete="off"
          onChange={e => { setCustomer(e.target.value); setError(''); }} />
      </Group>

      <Group header="Entrega">
        {place.location && <Row icon={MapPin} iconColor="#ff3b30" title={place.location} wrap />}
        <Cell className="py-1.5">
          <PlacesAutocomplete placeholder={place.location ? 'Buscar otra dirección' : 'Buscar dirección'}
            onSelect={(location, lat, lng) => setPlace({ location, lat, lng })} />
        </Cell>
      </Group>

      <Group header="Productos">
        {flavors.map(f => {
          const q = quantities[f.id] || 0;
          const short = q > available(f.id);
          return (
            <Row key={f.id} leading={<FlavorTile flavor={f} />} title={f.name}
              subtitle={<span className={cn(short && 'font-medium text-destructive')}>{available(f.id)} en stock</span>}>
              <span className="min-w-6 text-right text-[17px] font-semibold tabular-nums">{q}</span>
              <Stepper value={q} onChange={v => { setQuantities(x => ({ ...x, [f.id]: Math.max(0, v) })); setError(''); }} />
            </Row>
          );
        })}
      </Group>

      <Group>
        <TextField label="Precio por bolsa" type="number" inputMode="numeric" align="right"
          value={price} onChange={e => setPrice(e.target.value)} />
        <TextField multiline placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
      </Group>

      <div className="flex items-baseline justify-between px-4">
        <span className="text-[15px] text-muted-foreground">{totalBags} bolsa{totalBags !== 1 ? 's' : ''} × {money(pricePerBag)}</span>
        <span className="text-[22px] font-bold tabular-nums">{money(totalBags * pricePerBag)}</span>
      </div>
      {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
      {children}
    </form>
  );
}

// ─── Detail sheet ───────────────────────────────────────────────────────────
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
    <ModalSheet open={!!order} onOpenChange={v => !v && onClose()}
      title={editing ? 'Editar pedido' : o.customer}
      cancel={editing ? { label: 'Cancelar', onClick: () => setEditing(false) } : null}
      confirm={editing ? { label: 'Guardar', form: 'order-edit' } : { label: 'Listo', onClick: onClose }}>
      {editing ? (
        <OrderForm id="order-edit" initial={o} onSubmit={data => { editOrder(o._id, data); setEditing(false); }} />
      ) : (
        <>
          <div className="flex flex-col items-center pt-1 text-center">
            <StatusPill status={status} />
            <div className="mt-2 text-[44px] font-bold leading-none tabular-nums tracking-tight">{money(orderTotal(o))}</div>
            <div className="mt-2 text-[15px] text-muted-foreground">
              {o.totalBags} bolsa{o.totalBags !== 1 ? 's' : ''} · {formatOrderDate(o.date)}
            </div>
          </div>

          {!readOnly && next && (
            <BigButton onClick={() => editOrder(o._id, { status: next })}>
              Marcar como {statusOf(next).label.toLowerCase()}
            </BigButton>
          )}

          {!readOnly && (
            <Group>
              <SelectRow label="Estado" value={status} onChange={s => editOrder(o._id, { status: s })}
                options={STATUSES.map(s => ({ value: s.id, label: s.label }))} />
            </Group>
          )}

          <Group header="Productos">
            {Object.entries(o.quantities || {}).filter(([, q]) => q > 0).map(([id, q]) => {
              const f = flavorOf(flavors, id);
              return <Row key={id} leading={<FlavorTile flavor={f} size={32} />} title={f.name} detail={`× ${q}`} />;
            })}
            <Row title="Precio por bolsa" detail={money(o.pricePerBag || DEFAULT_PRICE)} />
          </Group>

          {(o.location || o.notes) && (
            <Group header="Entrega">
              {o.location && (
                <Row icon={MapPin} iconColor="#ff3b30" title={o.location} subtitle="Abrir en Google Maps" wrap chevron
                  onClick={() => window.open(mapsUrl(o), '_blank')} />
              )}
              {o.notes && <Row icon={StickyNote} iconColor="#ffcc00" title={o.notes} wrap />}
            </Group>
          )}

          {!readOnly && (
            <Group>
              <ButtonRow onClick={() => setEditing(true)}>Editar pedido</ButtonRow>
              <ButtonRow destructive onClick={remove}>Eliminar pedido</ButtonRow>
            </Group>
          )}
        </>
      )}
    </ModalSheet>
  );
}
