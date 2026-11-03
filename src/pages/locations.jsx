import { useState } from 'react';
import { ClipboardCheck, ClipboardList, PackageMinus, PackagePlus, Pencil, Plus, Refrigerator, ShoppingBag } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  DEFAULT_LOCATION_PRICE, cleanQty, flavorOf, movementOf, newId, orderTotal, owedOf, paidOf, sumBy, sumQty,
  historyEntries, isLocationSale,
} from '@/lib/data';
import { money, formatOrderDate } from '@/lib/format';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Section, Stack, Card, ListItem, ToneIcon, Chips, FlavorTile, Tag, IconButton, Button, Stepper, TextField,
  AmountField, EmptyState, Sheet, useSticky,
} from '@/components/kit';
import { FlavorTag } from '@/components/orders';

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;
const signed = (n) => (n > 0 ? `+${n}` : String(n));

// Sales at a point of sale that still owe something.
const unpaidAt = (orders, id) => orders.filter(o => o.locationId === id && owedOf(o) > 0);
export const owedAt = (orders, id) => sumBy(unpaidAt(orders, id), owedOf);

// ─── Rows used on Productos and Resumen ─────────────────────────────────────
export function LocationRow({ loc }) {
  const { orders } = useStore();
  const owed = owedAt(orders, loc._id);
  return (
    <ListItem icon={Refrigerator} tone="sky" title={loc.name} chevron onClick={() => navigate(`products/locations/${loc._id}`)}
      subtitle={[plural(sumQty(loc.stock), 'bolsa'), owed > 0 && `${money(owed)} por cobrar`].filter(Boolean).join(' · ')} />
  );
}

export function LocationsSection() {
  const { locations } = useStore();
  const [adding, setAdding] = useState(false);
  return (
    <Section title="Puntos de venta">
      <Stack>
        {locations.map(l => <LocationRow key={l._id} loc={l} />)}
        <button type="button" onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-input py-4 text-[15px] font-semibold text-muted-foreground transition-transform active:scale-[0.98]">
          <Plus className="size-5" /> Nuevo punto de venta
        </button>
      </Stack>
      <p className="px-1 text-[13px] text-muted-foreground">
        Congeladores u otros lugares con bolsas propias. No cuentan en el stock general hasta que vuelvan.
      </p>
      <LocationSheet open={adding} onClose={() => setAdding(false)} />
    </Section>
  );
}

// New or edit; `loc` is null for a new one.
function LocationSheet({ open, loc, onClose }) {
  const { orders, addLocation, editLocation, deleteLocation } = useStore();
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()} title={loc ? 'Editar punto de venta' : 'Nuevo punto de venta'}
      confirm={{ label: 'Guardar', form: 'location-form' }}>
      {open && (
        <LocationForm loc={loc}
          onSubmit={data => { loc ? editLocation(loc._id, data) : addLocation(data); onClose(); }}
          onDelete={loc && (() => {
            if (sumQty(loc.stock) > 0) { window.alert('Primero retirá las bolsas que quedan.'); return; }
            if (unpaidAt(orders, loc._id).length) { window.alert('Tiene ventas sin cobrar. Registrá el pago primero.'); return; }
            if (!window.confirm(`¿Eliminar ${loc.name}? Sus ventas siguen contando en los totales.`)) return;
            deleteLocation(loc._id);
            onClose();
            goBack('products');
          })} />
      )}
    </Sheet>
  );
}

function LocationForm({ loc, onSubmit, onDelete }) {
  const [name, setName] = useState(loc?.name || '');
  const [price, setPrice] = useState(String(loc?.price ?? DEFAULT_LOCATION_PRICE));
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Escribí el nombre'); return; }
    onSubmit({ name: name.trim(), price: parseInt(price, 10) || 0 });
  };
  return (
    <form id="location-form" onSubmit={submit} className="space-y-4">
      <TextField label="Nombre" placeholder="Ej. Congelador oficina" value={name} autoFocus={!loc}
        onChange={e => { setName(e.target.value); setError(''); }} />
      <TextField label="Precio por bolsa (₡)" type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} />
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
      {onDelete && <Button type="button" variant="danger" onClick={onDelete}>Eliminar punto de venta</Button>}
    </form>
  );
}

// ─── Point of sale ──────────────────────────────────────────────────────────
const ACTIONS = [
  { id: 'restock', label: 'Agregar', hint: 'Del stock general', icon: PackagePlus, tone: 'mint' },
  { id: 'count', label: 'Contar', hint: 'Lo que falta se vendió', icon: ClipboardCheck, tone: 'sky' },
  { id: 'sale', label: 'Venta', hint: 'Registrar una venta', icon: ShoppingBag, tone: 'butter' },
  { id: 'remove', label: 'Retirar', hint: 'Devolver o pérdida', icon: PackageMinus, tone: 'peach' },
];
const TITLES = { restock: 'Agregar bolsas', count: 'Contar el congelador', sale: 'Registrar venta', remove: 'Retirar bolsas', pay: 'Registrar pago' };

export function LocationPage({ id }) {
  const { locations, orders, movements, flavors, deleteOrder, deleteMovement } = useStore();
  const [sheet, setSheet] = useState(null);
  const mode = useSticky(sheet);
  const loc = locations.find(l => l._id === id);
  const back = { label: 'Productos', onClick: () => goBack('products') };
  if (!loc) return <Screen title="Punto de venta" back={back} />;

  const sales = orders.filter(o => o.locationId === id && o.status !== 'cancelado');
  const owed = owedAt(orders, id);
  const bags = sumQty(loc.stock);
  const feed = [
    ...sales.map(o => ({ kind: 'sale', item: o })),
    ...movements.filter(m => m.locationId === id).map(m => ({ kind: 'move', item: m })),
  ].sort((a, b) => b.item.date.localeCompare(a.item.date));

  const undo = ({ kind, item }) => {
    let message;
    if (kind === 'sale') {
      message = `¿Deshacer la venta de ${plural(item.totalBags, 'bolsa')}? Las bolsas vuelven al congelador.`
        + (paidOf(item) > 0 ? ` Ya tenía ${money(paidOf(item))} cobrados, que dejan de contar.` : '');
    } else if (item.type === 'payment') {
      message = `¿Deshacer el pago de ${money(item.amount)}? Vuelve a quedar por cobrar.`;
    } else {
      message = `¿Deshacer ${movementOf(item.type).label.toLowerCase()}? Las bolsas vuelven a donde estaban.`;
    }
    if (!window.confirm(message)) return;
    kind === 'sale' ? deleteOrder(item._id) : deleteMovement(item._id);
  };

  return (
    <Screen title={loc.name} eyebrow={`${money(loc.price)} por bolsa`} back={back}
      actions={<IconButton icon={Pencil} label="Editar" onClick={() => setSheet('edit')} />}>
      <div className="grain overflow-hidden rounded-[30px] bg-primary p-5 text-white shadow-float">
        <div className="text-[13px] font-semibold text-white/60">En el congelador</div>
        <div className="font-display text-[44px] font-bold leading-none tracking-tight text-brand-lime tabular-nums">
          {bags} <span className="text-[18px]">bolsas</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/10 px-3.5 py-2.5">
            <div className="text-[12px] text-white/60">Por cobrar</div>
            <div className="font-display text-[18px] font-bold tabular-nums">{money(owed)}</div>
          </div>
          <div className="rounded-2xl bg-white/10 px-3.5 py-2.5">
            <div className="text-[12px] text-white/60">Vendidas</div>
            <div className="font-display text-[18px] font-bold tabular-nums">{sumBy(sales, o => o.totalBags)} bolsas</div>
          </div>
        </div>
        <Button variant="lime" className="mt-4" disabled={!owed} onClick={() => setSheet('pay')}>
          {owed ? `Registrar pago · ${money(owed)}` : 'Nada por cobrar'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {flavors.map(f => {
          const n = loc.stock?.[f.id] || 0;
          return (
            <Card key={f.id} className="p-3.5">
              <FlavorTile flavor={f} size={40} />
              <div className="mt-2 truncate text-[13px] font-semibold">{f.name}</div>
              <div className={cn('font-display text-[26px] font-bold leading-tight tabular-nums', n < 0 && 'text-destructive')}>{n}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(a => (
          <Card key={a.id} tone={a.tone} onClick={() => setSheet(a.id)} className="p-4">
            <a.icon className="size-6" strokeWidth={2.1} />
            <div className="mt-2 font-display text-[18px] font-bold">{a.label}</div>
            <div className="text-[13px] text-foreground/60">{a.hint}</div>
          </Card>
        ))}
      </div>

      <Section title="Movimientos">
        {feed.length === 0 ? (
          <EmptyState emoji="🧊" title="Sin movimientos">Empezá agregando bolsas desde el stock general.</EmptyState>
        ) : (
          <Stack>
            {feed.map(e => <FeedItem key={e.item._id} entry={e} onClick={() => undo(e)} />)}
            <p className="px-1 text-[13px] text-muted-foreground">Tocá un movimiento para deshacerlo.</p>
          </Stack>
        )}
      </Section>

      <LocationSheet open={sheet === 'edit'} loc={loc} onClose={() => setSheet(null)} />
      <Sheet open={!!sheet && sheet !== 'edit'} onOpenChange={v => !v && setSheet(null)} title={TITLES[mode]}
        confirm={{ label: 'Guardar', form: 'move-form' }}>
        {mode === 'count' && <CountForm key={mode} loc={loc} onDone={() => setSheet(null)} />}
        {['restock', 'sale', 'remove'].includes(mode) && <MoveForm key={mode} mode={mode} loc={loc} onDone={() => setSheet(null)} />}
        {mode === 'pay' && <PaymentForm loc={loc} onDone={() => setSheet(null)} />}
      </Sheet>
    </Screen>
  );
}

function FeedItem({ entry: { kind, item }, onClick }) {
  const { flavors } = useStore();
  const tags = Object.entries(item.quantities || {}).filter(([, q]) => q)
    .map(([fid, q]) => <FlavorTag key={fid} flavor={flavorOf(flavors, fid)} qty={q} />);
  if (kind === 'sale') {
    return (
      <ListItem icon={ShoppingBag} tone="butter" onClick={onClick} meta={tags}
        title={`${item.source === 'count' ? 'Vendidas (conteo)' : 'Venta'} · ${plural(item.totalBags, 'bolsa')}`}
        subtitle={formatOrderDate(item.date)}
        trailing={
          <div className="shrink-0 self-start text-right">
            <div className="font-display text-[17px] font-bold tabular-nums">{money(orderTotal(item))}</div>
            {owedOf(item) <= 0 ? <Tag tone="mint">Cobrada</Tag>
              : paidOf(item) > 0 ? <Tag tone="butter">Faltan {money(owedOf(item))}</Tag>
              : <Tag tone="blush">Por cobrar</Tag>}
          </div>
        } />
    );
  }
  const t = movementOf(item.type);
  if (item.type === 'payment') {
    return (
      <ListItem icon={t.icon} tone={t.tone} onClick={onClick} title={t.label} subtitle={formatOrderDate(item.date)}
        trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums text-success">+{money(item.amount)}</span>} />
    );
  }
  return (
    <ListItem icon={t.icon} tone={t.tone} onClick={onClick} meta={tags} title={`${t.label} · ${plural(sumQty(item.quantities), 'bolsa')}`}
      subtitle={[formatOrderDate(item.date), item.note].filter(Boolean).join(' · ')} />
  );
}

// Agregar, Venta, Retirar: pick bags per flavor.
function MoveForm({ mode, loc, onDone }) {
  const { flavors, stock, addMovement, placeOrder } = useStore();
  const [quantities, setQuantities] = useState({});
  const [kind, setKind] = useState('return');
  const [price, setPrice] = useState(String(loc.price ?? DEFAULT_LOCATION_PRICE));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const fromGeneral = mode === 'restock';
  const available = (fid) => (fromGeneral ? stock[fid] || 0 : loc.stock?.[fid] || 0);
  const totalBags = sumQty(quantities);
  const pricePerBag = parseInt(price, 10) || 0;

  const submit = (e) => {
    e.preventDefault();
    if (!totalBags) { setError('Agregá al menos una bolsa'); return; }
    if (!fromGeneral && flavors.some(f => (quantities[f.id] || 0) > available(f.id))) {
      setError('No hay tantas bolsas en el congelador. Si el número no cuadra, usá Contar.'); return;
    }
    const q = cleanQty(quantities);
    if (mode === 'sale') {
      placeOrder({
        id: newId(), customer: loc.name, location: '', lat: null, lng: null, notes: note.trim(),
        quantities: q, totalBags, pricePerBag, totalPrice: totalBags * pricePerBag,
        status: 'entregado', date: new Date().toISOString(), locationId: loc._id, source: 'sale',
      });
    } else {
      addMovement({ type: mode === 'restock' ? 'restock' : kind, locationId: loc._id, quantities: q, note: note.trim() });
    }
    onDone();
  };

  return (
    <form id="move-form" onSubmit={submit} className="space-y-4">
      {mode === 'remove' && (
        <Chips value={kind} onChange={setKind} options={[
          { id: 'return', label: 'Devolver al stock general' },
          { id: 'loss', label: 'Pérdida' },
        ]} />
      )}
      <Stack>
        {flavors.map(f => {
          const q = quantities[f.id] || 0;
          const short = q > available(f.id);
          return (
            <Card key={f.id} className={cn('flex items-center gap-3 p-3 pr-3.5', q > 0 && 'ring-2 ring-brand-lime')}>
              <FlavorTile flavor={f} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{f.name}</div>
                <div className={cn('text-[13px]', short ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                  {available(f.id)} {fromGeneral ? 'en stock general' : 'en el congelador'}
                </div>
              </div>
              <Stepper value={q} onChange={v => { setQuantities(x => ({ ...x, [f.id]: Math.max(0, v) })); setError(''); }} />
            </Card>
          );
        })}
      </Stack>
      {mode === 'sale' && (
        <TextField label="Precio por bolsa (₡)" type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} />
      )}
      <TextField label="Nota (opcional)" placeholder={mode === 'remove' && kind === 'loss' ? 'Ej. vencidas' : ''} value={note} onChange={e => setNote(e.target.value)} />
      {mode === 'sale' && (
        <div className="flex items-center justify-between rounded-[22px] bg-primary px-5 py-4 text-white">
          <span className="text-[14px] text-white/70">{plural(totalBags, 'bolsa')} × {money(pricePerBag)}</span>
          <span className="font-display text-[26px] font-bold text-brand-lime tabular-nums">{money(totalBags * pricePerBag)}</span>
        </div>
      )}
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
    </form>
  );
}

// Contar: type what's left; the difference becomes a sale.
function CountForm({ loc, onDone }) {
  const { flavors, countLocation } = useStore();
  const had = (fid) => loc.stock?.[fid] || 0;
  const [counted, setCounted] = useState(() => Object.fromEntries(flavors.map(f => [f.id, String(had(f.id))])));
  const value = (fid) => Math.max(0, parseInt(counted[fid], 10) || 0);
  const soldOf = (fid) => Math.max(0, had(fid) - value(fid));
  const sold = sumBy(flavors, f => soldOf(f.id));
  const extra = sumBy(flavors, f => Math.max(0, value(f.id) - had(f.id)));

  const submit = (e) => {
    e.preventDefault();
    countLocation(loc, Object.fromEntries(flavors.map(f => [f.id, value(f.id)])));
    onDone();
  };

  return (
    <form id="move-form" onSubmit={submit} className="space-y-4">
      <p className="px-1 text-[14px] text-muted-foreground">Escribí cuántas bolsas quedan de cada sabor. Las que faltan se registran como vendidas.</p>
      <Stack>
        {flavors.map(f => (
          <Card key={f.id} className="flex items-center gap-3 p-3 pr-4">
            <FlavorTile flavor={f} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold">{f.name}</div>
              <div className="text-[13px] text-muted-foreground">
                Había {had(f.id)}{soldOf(f.id) > 0 && <b className="text-foreground"> · {soldOf(f.id)} vendidas</b>}
              </div>
            </div>
            <input type="number" inputMode="numeric" min="0" aria-label={`Quedan de ${f.name}`}
              value={counted[f.id]} onChange={e => setCounted(x => ({ ...x, [f.id]: e.target.value }))} onFocus={e => e.target.select()}
              className="h-11 w-20 rounded-2xl bg-muted px-3 text-right font-display text-[20px] font-bold outline-none focus:ring-2 focus:ring-brand-lime" />
          </Card>
        ))}
      </Stack>
      <div className="flex items-center justify-between rounded-[22px] bg-primary px-5 py-4 text-white">
        <span className="text-[14px] text-white/70">{plural(sold, 'bolsa')} vendida{sold !== 1 ? 's' : ''} × {money(loc.price)}</span>
        <span className="font-display text-[26px] font-bold text-brand-lime tabular-nums">{money(sold * (loc.price || 0))}</span>
      </div>
      {extra > 0 && (
        <p className="px-1 text-[13px] text-muted-foreground">Hay {plural(extra, 'bolsa')} de más; se registran como ajuste.</p>
      )}
    </form>
  );
}

// ─── Payments ───────────────────────────────────────────────────────────────
// Full or partial lump payment; it settles the oldest sales first.
export function PaymentForm({ loc, onDone }) {
  const { orders, payLocation } = useStore();
  const owed = owedAt(orders, loc._id);
  const [kind, setKind] = useState('full');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const value = kind === 'full' ? owed : Number(amount) || 0;

  const submit = (e) => {
    e.preventDefault();
    if (value <= 0) { setError('Escribí cuánto pagaron'); return; }
    if (value > owed + 0.005) { setError(`Solo deben ${money(owed)}`); return; }
    payLocation(loc, value);
    onDone();
  };

  return (
    <form id="move-form" onSubmit={submit} className="space-y-4">
      <Card className="flex items-center justify-between p-4">
        <div>
          <div className="text-[13px] font-semibold text-muted-foreground">{loc.name} debe</div>
          <div className="font-display text-[28px] font-bold leading-tight tabular-nums">{money(owed)}</div>
        </div>
        <Refrigerator className="size-8 text-muted-foreground/60" />
      </Card>
      <Chips value={kind} onChange={k => { setKind(k); setError(''); }} options={[
        { id: 'full', label: 'Pagaron todo' },
        { id: 'partial', label: 'Pagaron una parte' },
      ]} />
      {kind === 'partial' && (
        <>
          <AmountField value={amount} autoFocus onChange={v => { setAmount(v); setError(''); }} />
          {value > 0 && value <= owed && (
            <p className="px-1 text-[14px] text-muted-foreground">Quedan {money(Math.round((owed - value) * 100) / 100)} por cobrar.</p>
          )}
        </>
      )}
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
    </form>
  );
}

// Opened from "Por cobrar" on Resumen: each point of sale's balance plus the
// delivery orders still unpaid.
export function ReceivablesSheet({ open, onClose }) {
  const { orders, locations } = useStore();
  const [payingId, setPayingId] = useState(null);
  const paying = useSticky(locations.find(l => l._id === payingId));
  const owing = locations.map(l => ({ loc: l, owed: owedAt(orders, l._id) })).filter(x => x.owed > 0);
  const delivery = orders.filter(o => !isLocationSale(o) && owedOf(o) > 0);
  const close = () => { setPayingId(null); onClose(); };

  return (
    <Sheet open={open} onOpenChange={v => !v && close()} title={payingId ? 'Registrar pago' : 'Por cobrar'}
      onBack={payingId ? () => setPayingId(null) : undefined}
      confirm={payingId ? { label: 'Guardar pago', form: 'move-form' } : undefined}>
      {payingId && paying ? (
        <PaymentForm key={payingId} loc={paying} onDone={() => setPayingId(null)} />
      ) : (
        <Stack>
          {owing.map(({ loc, owed }) => (
            <ListItem key={loc._id} icon={Refrigerator} tone="sky" title={loc.name} subtitle="Tocá para registrar un pago" chevron
              onClick={() => setPayingId(loc._id)}
              trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums">{money(owed)}</span>} />
          ))}
          <ListItem icon={ClipboardList} tone="butter" title="Pedidos" chevron onClick={() => { close(); navigate('orders'); }}
            subtitle={delivery.length ? plural(delivery.length, 'pedido') + ' sin cobrar' : 'Todo cobrado'}
            trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums">{money(sumBy(delivery, owedOf))}</span>} />
          {owing.length === 0 && locations.length > 0 && (
            <p className="px-1 text-[13px] text-muted-foreground">Los puntos de venta no deben nada.</p>
          )}
        </Stack>
      )}
    </Sheet>
  );
}

// ─── Inventory history ──────────────────────────────────────────────────────
export function InventoryHistoryPage() {
  const { allMovements, locations, flavors } = useStore();
  const entries = historyEntries(allMovements);
  const nameOf = (id) => locations.find(l => l._id === id)?.name || 'Punto de venta eliminado';

  return (
    <Screen title="Historial de inventario" back={{ label: 'Productos', onClick: () => goBack('products') }}>
      {entries.length === 0 ? (
        <EmptyState emoji="🗒️" title="Sin cambios todavía">
          Cada vez que cambies el inventario a mano o muevas bolsas a un punto de venta, va a quedar acá.
        </EmptyState>
      ) : (
        <Stack>
          {entries.map(m => {
            const t = movementOf(m.type);
            const items = Object.entries(m.quantities).filter(([, q]) => q);
            return (
              <Card key={m._id} className="flex gap-3.5 px-4 py-3.5">
                <ToneIcon icon={t.icon} tone={t.tone} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{m.locationId ? `${t.label} · ${nameOf(m.locationId)}` : t.label}</div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground">{formatOrderDate(m.date)}</div>
                  <div className="mt-2 space-y-1">
                    {items.map(([fid, q]) => {
                      const f = flavorOf(flavors, fid);
                      const change = m.type === 'manual' ? q : q * t.general;
                      return (
                        <div key={fid} className="flex items-center justify-between gap-2 text-[14px]">
                          <span className="truncate">{f.emoji} {f.name}</span>
                          <span className="shrink-0 tabular-nums">
                            <b className={cn(change > 0 ? 'text-success' : 'text-destructive')}>{signed(change)}</b>
                            {m.after?.[fid] != null && <span className="text-muted-foreground"> → {m.after[fid]} bolsas</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </Stack>
      )}
      <p className="px-1 text-[13px] text-muted-foreground">
        El historial empieza el 2 de noviembre de 2026; los cambios anteriores no quedaron guardados.
      </p>
    </Screen>
  );
}
