import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { Archive, ArrowLeftRight, Calculator, LogOut, MapPin, Pencil, Plus, Users } from 'lucide-react';
import { auth } from '@/firebase';
import { useStore } from '@/lib/store';
import { COMPANY, newId, partnerBalances, summarize, sumBy, consumed, categoryOf, myPartnerId } from '@/lib/data';
import { money, formatDay, formatRange } from '@/lib/format';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Section, Stack, Card, ListItem, Chips, TextField, Button, IconButton, Avatar, FlavorTile, EmptyState, Sheet, useSticky,
} from '@/components/kit';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { OrderCard, OrderSheet } from '@/components/orders';

const back = { label: 'Ajustes', onClick: () => goBack('settings') };

export function SettingsPage() {
  const { partners, settings, archives } = useStore();
  const email = auth.currentUser?.email || '';
  const me = partners.find(p => p.id === myPartnerId(partners));
  const name = me?.name || email.split('@')[0];

  return (
    <Screen title="Ajustes" actions={<IconButton icon={Pencil} label="Editar socios" onClick={() => navigate('settings/partners')} />}>
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="rounded-full bg-white/70 p-2.5 shadow-soft">
          <Avatar name={name} size={96} className="text-[40px]" />
        </div>
        <div className="mt-4 font-display text-[26px] font-bold capitalize leading-tight">{name}</div>
        <div className="text-[14px] text-muted-foreground">{email}</div>
      </div>

      <Stack>
        <ListItem icon={Users} tone="sky" title="Socios" chevron onClick={() => navigate('settings/partners')}
          subtitle={partners.length ? partners.map(p => p.name).join(', ') : 'Quién paga los gastos'} />
        <ListItem icon={MapPin} tone="blush" title="Direcciones de ruta" chevron onClick={() => navigate('settings/addresses')}
          subtitle={settings.factoryAddress || 'Configurá la fábrica'} />
        <ListItem icon={Archive} tone="lilac" title="Historial" chevron onClick={() => navigate('settings/history')}
          subtitle={archives.length ? `${archives.length} período${archives.length !== 1 ? 's' : ''} cerrado${archives.length !== 1 ? 's' : ''}` : 'Cerrá un período y empezá de cero'} />
        <ListItem icon={Calculator} tone="mint" title="Recalcular inventario" chevron onClick={() => navigate('settings/inventory')}
          subtitle="A partir del stock inicial" />
        <ListItem icon={LogOut} tone="gray" title="Cerrar sesión" danger onClick={() => window.confirm('¿Cerrar sesión?') && signOut(auth)} />
      </Stack>

      <p className="pb-2 text-center text-[12px] text-muted-foreground">Frizo · hecho con 🥤 en Costa Rica</p>
    </Screen>
  );
}

// ─── Socios ─────────────────────────────────────────────────────────────────
export function PartnersPage() {
  const { partners, savePartners } = useStore();
  const [editing, setEditing] = useState(null); // partner or 'new'
  const shown = useSticky(editing);

  const save = (p) => {
    savePartners(partners.some(x => x.id === p.id) ? partners.map(x => x.id === p.id ? p : x) : [...partners, p]);
    setEditing(null);
  };
  const remove = (p) => {
    if (!window.confirm(`¿Quitar a ${p.name}? Sus gastos y pagos dejarán de contar en los saldos.`)) return;
    savePartners(partners.filter(x => x.id !== p.id));
    setEditing(null);
  };

  return (
    <Screen title="Socios" back={back} actions={<IconButton icon={Plus} label="Agregar socio" dark onClick={() => setEditing('new')} />}>
      {partners.length === 0 ? (
        <EmptyState emoji="🤝" title="Sin socios todavía" action={<Button onClick={() => setEditing('new')}><Plus /> Agregar socio</Button>}>
          Las personas que pagan gastos del negocio.
        </EmptyState>
      ) : (
        <Stack>
          {partners.map(p => (
            <ListItem key={p.id} leading={<Avatar name={p.name} />} title={p.name} subtitle={p.email || 'Sin correo'} chevron onClick={() => setEditing(p)} />
          ))}
        </Stack>
      )}
      <p className="px-1 text-[13px] text-muted-foreground">
        Si el correo coincide con el del usuario, los gastos que esa persona registre quedan a su nombre.
      </p>

      <Sheet open={!!editing} onOpenChange={v => !v && setEditing(null)}
        title={shown === 'new' ? 'Nuevo socio' : 'Editar socio'} confirm={{ label: 'Guardar', form: 'partner-form' }}>
        {shown && <PartnerForm partner={shown === 'new' ? null : shown} onSubmit={save} onDelete={shown !== 'new' && (() => remove(shown))} />}
      </Sheet>
    </Screen>
  );
}

function PartnerForm({ partner, onSubmit, onDelete }) {
  const [name, setName] = useState(partner?.name || '');
  const [email, setEmail] = useState(partner?.email ?? (partner ? '' : auth.currentUser?.email || ''));
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Escribí el nombre'); return; }
    onSubmit({ id: partner?.id || newId(), name: name.trim(), email: email.trim() });
  };

  return (
    <form id="partner-form" onSubmit={submit} className="space-y-4">
      <div className="flex justify-center py-2"><Avatar name={name || '?'} size={84} className="ring-4 ring-white shadow-soft" /></div>
      <TextField label="Nombre" placeholder="Ej. Neto" value={name} autoFocus={!partner} onChange={e => { setName(e.target.value); setError(''); }} />
      <TextField label="Correo (opcional)" placeholder="correo@ejemplo.com" type="email" autoCapitalize="off" value={email} onChange={e => setEmail(e.target.value)} />
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
      {onDelete && <Button type="button" variant="danger" onClick={onDelete}>Quitar socio</Button>}
    </form>
  );
}

// ─── Direcciones ────────────────────────────────────────────────────────────
function AddressCard({ title, hint, tone, value, onSelect, onClear }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: tone.bg, color: tone.fg }}>
          <MapPin className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold">{title}</div>
          <div className={cn('text-[14px]', value ? 'font-medium' : 'text-muted-foreground')}>{value || hint}</div>
        </div>
        {value && onClear && <button type="button" onClick={onClear} className="text-[13px] font-semibold text-destructive">Quitar</button>}
      </div>
      <div className="mt-3 rounded-2xl bg-muted px-3">
        <PlacesAutocomplete placeholder={value ? 'Buscar otra dirección' : 'Buscar dirección'} onSelect={onSelect} />
      </div>
    </Card>
  );
}

export function AddressesPage() {
  const { settings, saveSettings } = useStore();
  const [factory, setFactory] = useState(null);
  const [ret, setRet] = useState(null);

  useEffect(() => {
    setFactory({ address: settings.factoryAddress || '', lat: settings.factoryLat ?? null, lng: settings.factoryLng ?? null });
    setRet({ address: settings.returnAddress || '', lat: settings.returnLat ?? null, lng: settings.returnLng ?? null });
  }, [settings]);

  if (!factory) return null;
  const save = () => {
    saveSettings({
      factoryAddress: factory.address, factoryLat: factory.lat, factoryLng: factory.lng,
      returnAddress: ret.address, returnLat: ret.lat, returnLng: ret.lng,
    });
    goBack('settings');
  };

  return (
    <Screen title="Direcciones" back={back}>
      <AddressCard title="Fábrica" hint="Punto de salida de las rutas" tone={{ bg: '#fde4ee', fg: '#d63d7a' }}
        value={factory.address} onSelect={(address, lat, lng) => setFactory({ address, lat, lng })} />
      <AddressCard title="Regreso (opcional)" hint="Si lo dejás vacío, la ruta termina en la fábrica" tone={{ bg: '#ffe9dc', fg: '#d2652a' }}
        value={ret.address} onSelect={(address, lat, lng) => setRet({ address, lat, lng })}
        onClear={() => setRet({ address: '', lat: null, lng: null })} />
      <Button onClick={save}>Guardar direcciones</Button>
    </Screen>
  );
}

// ─── Recalcular inventario ──────────────────────────────────────────────────
export function RecalcPage() {
  const { flavors, orders, replaceStock } = useStore();
  const [initial, setInitial] = useState({});
  const [result, setResult] = useState(null);
  const sold = (id) => sumBy(orders, o => consumed(o)[id]);

  const run = () => {
    const next = Object.fromEntries(flavors.map(f => [f.id, (parseInt(initial[f.id], 10) || 0) - sold(f.id)]));
    if (!window.confirm('Esto reemplaza el inventario actual. ¿Continuar?')) return;
    replaceStock(next);
    setResult(next);
  };

  return (
    <Screen title="Recalcular inventario" back={back}>
      <p className="px-1 text-[14px] text-muted-foreground">
        Escribí cuántas bolsas había al empezar el período. Se restan las de los pedidos actuales (sin contar los cancelados).
      </p>
      <Stack>
        {flavors.map(f => (
          <Card key={f.id} className="flex items-center gap-3 p-3 pr-4">
            <FlavorTile flavor={f} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold">{f.name}</div>
              <div className="text-[13px] text-muted-foreground">{sold(f.id)} vendidas</div>
            </div>
            <input type="number" inputMode="numeric" placeholder="0" aria-label={`Stock inicial de ${f.name}`}
              value={initial[f.id] ?? ''} onChange={e => { setInitial(x => ({ ...x, [f.id]: e.target.value })); setResult(null); }}
              className="h-11 w-24 rounded-2xl bg-muted px-3 text-right font-display text-[20px] font-bold outline-none focus:ring-2 focus:ring-brand-lime" />
          </Card>
        ))}
      </Stack>
      <Button onClick={run}>Recalcular y guardar</Button>
      {result && (
        <Card tone="mint" className="space-y-2 p-5">
          <div className="font-display text-[18px] font-bold">Inventario nuevo</div>
          {flavors.map(f => (
            <div key={f.id} className="flex items-center justify-between text-[15px]">
              <span>{f.emoji} {f.name}</span>
              <b className="font-display text-[20px] tabular-nums">{result[f.id]}</b>
            </div>
          ))}
        </Card>
      )}
    </Screen>
  );
}

// ─── Historial ──────────────────────────────────────────────────────────────
export function HistoryPage() {
  const { archives, allOrders, orders, costs, transfers, closePeriod } = useStore();
  const [closing, setClosing] = useState(false);
  const [label, setLabel] = useState('');
  const periods = [...archives].reverse();
  const empty = !orders.length && !costs.length && !transfers.length;

  const open = () => { setLabel(archives.length ? '' : 'Antes del relanzamiento'); setClosing(true); };
  const confirm = () => {
    const name = label.trim() || `Hasta el ${formatDay(new Date().toISOString())}`;
    if (!window.confirm(`Se archivan ${orders.length} pedidos, ${costs.length} gastos y ${transfers.length} pagos en "${name}". ¿Continuar?`)) return;
    closePeriod(name);
    setClosing(false);
  };

  return (
    <Screen title="Historial" back={back}>
      <div className="grain overflow-hidden rounded-[30px] bg-primary p-5 text-white shadow-float">
        <div className="text-[13px] font-semibold text-white/60">Período actual</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['Pedidos', orders.length], ['Gastos', costs.length], ['Pagos', transfers.length]].map(([l, n]) => (
            <div key={l} className="rounded-2xl bg-white/10 px-3 py-2.5">
              <div className="font-display text-[26px] font-bold leading-none text-brand-lime tabular-nums">{n}</div>
              <div className="mt-1 text-[12px] text-white/60">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-snug text-white/70">
          Al cerrarlo, todo esto pasa al historial y la app arranca de cero. Productos, socios, direcciones e inventario se mantienen.
        </p>
        <Button variant="lime" className="mt-4" disabled={empty} onClick={open}>Cerrar período y empezar de cero</Button>
      </div>

      <Section title="Períodos anteriores">
        {periods.length === 0 ? (
          <EmptyState emoji="🗂️" title="Nada archivado todavía">Los períodos que cierres van a aparecer acá.</EmptyState>
        ) : (
          <Stack>
            {periods.map(a => (
              <ListItem key={a.id} icon={Archive} tone="lilac" title={a.label} chevron onClick={() => navigate(`settings/history/${a.id}`)}
                subtitle={`${formatRange(a.startedAt, a.closedAt)} · ${allOrders.filter(o => o.archive === a.id).length} pedidos`} />
            ))}
          </Stack>
        )}
      </Section>

      <Sheet open={closing} onOpenChange={setClosing} title="Cerrar período" confirm={{ label: 'Archivar y empezar de cero', onClick: confirm }}>
        <div className="flex flex-col items-center py-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-[#ece7fc] text-3xl">🗂️</span>
          <p className="mt-3 max-w-xs text-[15px] text-muted-foreground">
            {orders.length} pedidos, {costs.length} gastos y {transfers.length} pagos pasan al historial, donde los podés seguir viendo. No se borra nada.
          </p>
        </div>
        <TextField label="Nombre del período" placeholder="Ej. Antes del relanzamiento" value={label} onChange={e => setLabel(e.target.value)} />
      </Sheet>
    </Screen>
  );
}

export function PeriodPage({ id }) {
  const { archives, allOrders, allCosts, allTransfers, partners } = useStore();
  const [tab, setTab] = useState('orders');
  const [selected, setSelected] = useState(null);
  const period = archives.find(a => a.id === id);
  const histBack = { label: 'Historial', onClick: () => goBack('settings/history') };
  if (!period) return <Screen title="Período" back={histBack} />;

  const orders = allOrders.filter(o => o.archive === id);
  const costs = allCosts.filter(c => c.archive === id);
  const transfers = allTransfers.filter(t => t.archive === id);
  const s = summarize(orders, costs);
  const balances = partnerBalances(partners, costs, transfers);
  const nameOf = (pid) => [COMPANY, ...partners].find(p => p.id === pid)?.name || (pid ? 'Socio eliminado' : 'Sin indicar');

  return (
    <Screen title={period.label} eyebrow={formatRange(period.startedAt, period.closedAt)} back={histBack}>
      <div className="grain overflow-hidden rounded-[30px] bg-primary p-5 text-white shadow-float">
        <div className="text-[13px] font-semibold text-white/60">Ganancia del período</div>
        <div className="font-display text-[40px] font-bold leading-tight text-brand-lime tabular-nums">{money(s.profit)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[['Cobrado', money(s.paid)], ['Gastos', money(s.spent)], ['Pedidos', s.count], ['Bolsas', s.bags]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/10 px-3.5 py-2.5">
              <div className="text-[12px] text-white/60">{l}</div>
              <div className="font-display text-[18px] font-bold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {partners.length > 0 && (
        <Section title="Saldos al cierre">
          <div className="grid grid-cols-2 gap-3">
            {partners.map(p => {
              const b = balances[p.id];
              return (
                <Card key={p.id} className="p-4">
                  <Avatar name={p.name} size={36} />
                  <div className="mt-2 truncate text-[15px] font-semibold">{p.name}</div>
                  <div className="text-[12px] text-muted-foreground">{b > 0.005 ? 'La empresa le debía' : b < -0.005 ? 'Le debía a la empresa' : 'Al día'}</div>
                  <div className="font-display text-[20px] font-bold tabular-nums">{money(Math.abs(b))}</div>
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      <Chips value={tab} onChange={setTab} options={[
        { id: 'orders', label: 'Pedidos', count: orders.length },
        { id: 'costs', label: 'Gastos', count: costs.length },
        { id: 'transfers', label: 'Pagos', count: transfers.length },
      ]} />

      {tab === 'orders' && (orders.length
        ? <Stack>{orders.map(o => <OrderCard key={o._id} order={o} onClick={() => setSelected(o)} />)}</Stack>
        : <EmptyState emoji="📋" title="Sin pedidos" />)}
      {tab === 'costs' && (costs.length
        ? <Stack>{costs.map(c => (
            <ListItem key={c._id} icon={categoryOf(c.category).icon} tone={categoryOf(c.category).tone} title={c.description}
              subtitle={`${c.paidBy ? `Pagó ${nameOf(c.paidBy)}` : 'Sin indicar quién pagó'} · ${formatDay(c.date)}`}
              trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums">{money(c.amount)}</span>} />
          ))}</Stack>
        : <EmptyState emoji="🧾" title="Sin gastos" />)}
      {tab === 'transfers' && (transfers.length
        ? <Stack>{transfers.map(t => (
            <ListItem key={t._id} icon={ArrowLeftRight} tone="lilac" title={`${nameOf(t.from)} → ${nameOf(t.to)}`}
              subtitle={[t.note, formatDay(t.date)].filter(Boolean).join(' · ')}
              trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums">{money(t.amount)}</span>} />
          ))}</Stack>
        : <EmptyState emoji="💸" title="Sin pagos" />)}

      <OrderSheet order={selected} onClose={() => setSelected(null)} readOnly />
    </Screen>
  );
}
