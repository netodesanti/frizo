import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { Archive, Calculator, MapPin, Plus, Users } from 'lucide-react';
import { auth } from '@/firebase';
import { useStore } from '@/lib/store';
import { COMPANY, newId, partnerBalances, summarize, sumBy, consumed } from '@/lib/data';
import { money, formatDay, formatRange } from '@/lib/format';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Group, Row, Cell, ButtonRow, TextField, Segmented, BigButton, Avatar, FlavorTile,
  EmptyState, NavButton, ModalSheet, useSticky,
} from '@/components/ios';
import { PlacesAutocomplete } from '@/components/places-autocomplete';
import { OrderListRow, OrderSheet } from '@/components/orders';

const back = { label: 'Ajustes', onClick: () => goBack('settings') };

export function SettingsPage() {
  const { partners, settings, archives } = useStore();
  const email = auth.currentUser?.email || '';

  return (
    <Screen title="Ajustes">
      <Group>
        <Row leading={<Avatar name={email} size={44} />} title={email} subtitle="Administrador" className="py-1" />
      </Group>

      <Group header="Negocio">
        <Row icon={Users} iconColor="#007aff" title="Socios" detail={partners.length || null} chevron onClick={() => navigate('settings/partners')} />
        <Row icon={MapPin} iconColor="#ff3b30" title="Direcciones de ruta" chevron onClick={() => navigate('settings/addresses')}
          detail={settings.factoryLat ? null : 'Sin configurar'} />
      </Group>

      <Group header="Datos">
        <Row icon={Calculator} iconColor="#34c759" title="Recalcular inventario" chevron onClick={() => navigate('settings/inventory')} />
        <Row icon={Archive} iconColor="#5856d6" title="Historial" detail={archives.length || null} chevron onClick={() => navigate('settings/history')} />
      </Group>

      <Group>
        <ButtonRow destructive center onClick={() => window.confirm('¿Cerrar sesión?') && signOut(auth)}>Cerrar sesión</ButtonRow>
      </Group>
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
    <Screen title="Socios" back={back} actions={<NavButton icon={Plus} label="Agregar socio" onClick={() => setEditing('new')} />}>
      <Group footer="Las personas que pagan gastos del negocio. Si el correo coincide con el de su usuario, los gastos que registre quedan a su nombre.">
        {partners.map(p => (
          <Row key={p.id} leading={<Avatar name={p.name} />} title={p.name} subtitle={p.email || 'Sin correo'} chevron onClick={() => setEditing(p)} />
        ))}
        <ButtonRow icon={Plus} onClick={() => setEditing('new')}>Agregar socio</ButtonRow>
      </Group>

      <ModalSheet open={!!editing} onOpenChange={v => !v && setEditing(null)}
        title={shown === 'new' ? 'Nuevo socio' : 'Editar socio'} confirm={{ label: 'Guardar', form: 'partner-form' }}>
        {shown && (
          <PartnerForm partner={shown === 'new' ? null : shown} onSubmit={save}
            onDelete={shown !== 'new' && (() => remove(shown))} />
        )}
      </ModalSheet>
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
    <form id="partner-form" onSubmit={submit} className="space-y-6">
      <div className="flex justify-center pt-2"><Avatar name={name || '?'} size={72} /></div>
      <Group footer="El correo es opcional.">
        <TextField placeholder="Nombre" value={name} autoFocus={!partner} onChange={e => { setName(e.target.value); setError(''); }} />
        <TextField placeholder="Correo" type="email" autoCapitalize="off" value={email} onChange={e => setEmail(e.target.value)} />
      </Group>
      {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
      {onDelete && <Group><ButtonRow destructive center onClick={onDelete}>Quitar socio</ButtonRow></Group>}
    </form>
  );
}

// ─── Direcciones ────────────────────────────────────────────────────────────
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
    <Screen title="Direcciones" back={back} actions={<NavButton label="Guardar" bold onClick={save} />}>
      <Group header="Fábrica" footer="Punto de salida de las rutas de entrega.">
        {factory.address && <Row icon={MapPin} iconColor="#ff3b30" title={factory.address} wrap />}
        <Cell className="py-1.5">
          <PlacesAutocomplete placeholder={factory.address ? 'Buscar otra dirección' : 'Buscar dirección'}
            onSelect={(address, lat, lng) => setFactory({ address, lat, lng })} />
        </Cell>
      </Group>
      <Group header="Regreso" footer="Opcional. Si lo dejás vacío, la ruta termina en la fábrica.">
        {ret.address && <Row icon={MapPin} iconColor="#ff9500" title={ret.address} wrap />}
        <Cell className="py-1.5">
          <PlacesAutocomplete placeholder={ret.address ? 'Buscar otra dirección' : 'Buscar dirección'}
            onSelect={(address, lat, lng) => setRet({ address, lat, lng })} />
        </Cell>
        {ret.address && <ButtonRow destructive onClick={() => setRet({ address: '', lat: null, lng: null })}>Quitar punto de regreso</ButtonRow>}
      </Group>
      <BigButton onClick={save}>Guardar</BigButton>
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
      <Group header="Stock inicial" footer="Escribí cuántas bolsas había al empezar el período. Se restan las bolsas de los pedidos actuales (sin contar los cancelados).">
        {flavors.map(f => (
          <TextField key={f.id} label={`${f.emoji} ${f.name}`} type="number" inputMode="numeric" align="right" placeholder="0"
            value={initial[f.id] ?? ''} onChange={e => { setInitial(x => ({ ...x, [f.id]: e.target.value })); setResult(null); }} />
        ))}
      </Group>
      <BigButton onClick={run}>Recalcular y guardar</BigButton>
      {result && (
        <Group header="Inventario nuevo">
          {flavors.map(f => (
            <Row key={f.id} leading={<FlavorTile flavor={f} size={32} />} title={f.name}
              subtitle={`${parseInt(initial[f.id], 10) || 0} iniciales − ${sold(f.id)} vendidas`}
              detail={result[f.id]} detailClassName="font-semibold text-foreground" />
          ))}
        </Group>
      )}
    </Screen>
  );
}

// ─── Historial ──────────────────────────────────────────────────────────────
export function HistoryPage() {
  const { archives, allOrders, orders, costs, transfers, closePeriod } = useStore();
  const [closing, setClosing] = useState(false);
  const periods = [...archives].reverse();

  return (
    <Screen title="Historial" back={back}>
      {periods.length === 0 ? (
        <EmptyState icon={Archive} title="Sin períodos cerrados">
          Cuando cierres un período, sus pedidos, gastos y pagos se guardan acá y la app arranca de cero.
        </EmptyState>
      ) : (
        <Group header="Períodos anteriores">
          {periods.map(a => (
            <Row key={a.id} icon={Archive} iconColor="#5856d6" title={a.label} chevron onClick={() => navigate(`settings/history/${a.id}`)}
              subtitle={`${formatRange(a.startedAt, a.closedAt)} · ${allOrders.filter(o => o.archive === a.id).length} pedidos`} />
          ))}
        </Group>
      )}

      <Group header="Período actual"
        footer="Mueve los pedidos, gastos y pagos actuales al historial. Productos, socios, direcciones e inventario se mantienen, y los saldos arrancan en cero.">
        <Row title="Pedidos" detail={orders.length} />
        <Row title="Gastos" detail={costs.length} />
        <Row title="Pagos" detail={transfers.length} />
        <ButtonRow destructive disabled={!orders.length && !costs.length && !transfers.length} onClick={() => setClosing(true)}>
          Cerrar período y empezar de cero…
        </ButtonRow>
      </Group>

      <ModalSheet open={closing} onOpenChange={setClosing} title="Cerrar período">
        <ClosePeriodForm suggested={archives.length ? '' : 'Antes del relanzamiento'}
          counts={{ orders: orders.length, costs: costs.length, transfers: transfers.length }}
          onConfirm={label => { closePeriod(label); setClosing(false); }} />
      </ModalSheet>
    </Screen>
  );
}

function ClosePeriodForm({ suggested, counts, onConfirm }) {
  const [label, setLabel] = useState(suggested);
  const confirm = () => {
    const name = label.trim() || `Hasta el ${formatDay(new Date().toISOString())}`;
    if (!window.confirm(`Se archivan ${counts.orders} pedidos, ${counts.costs} gastos y ${counts.transfers} pagos en "${name}". ¿Continuar?`)) return;
    onConfirm(name);
  };
  return (
    <>
      <div className="flex flex-col items-center px-4 pt-2 text-center">
        <Archive className="size-12 text-[#5856d6]" strokeWidth={1.5} />
        <p className="mt-3 text-[15px] text-muted-foreground">
          {counts.orders} pedidos, {counts.costs} gastos y {counts.transfers} pagos pasan al historial, donde los podés seguir viendo. No se borra nada.
        </p>
      </div>
      <Group header="Nombre del período">
        <TextField placeholder="Ej. Antes del relanzamiento" value={label} onChange={e => setLabel(e.target.value)} />
      </Group>
      <BigButton variant="destructive" onClick={confirm}>Archivar y empezar de cero</BigButton>
    </>
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
    <Screen title={period.label} subtitle={formatRange(period.startedAt, period.closedAt)} back={histBack}>
      <Group header="Resumen">
        <Row title="Pedidos" detail={s.count} />
        <Row title="Bolsas vendidas" detail={s.bags} />
        <Row title="Cobrado" detail={money(s.paid)} />
        <Row title="Gastos" detail={money(s.spent)} />
        <Row title="Ganancia" detail={money(s.profit)} detailClassName={cn('font-semibold', s.profit >= 0 ? 'text-success' : 'text-destructive')} />
      </Group>

      {partners.length > 0 && (
        <Group header="Saldos al cierre">
          {partners.map(p => {
            const b = balances[p.id];
            return (
              <Row key={p.id} leading={<Avatar name={p.name} size={32} />} title={p.name}
                subtitle={b > 0.005 ? 'La empresa le debía' : b < -0.005 ? 'Le debía a la empresa' : 'Al día'} detail={money(Math.abs(b))} />
            );
          })}
        </Group>
      )}

      <Segmented value={tab} onChange={setTab} options={[
        { id: 'orders', label: `Pedidos (${orders.length})` },
        { id: 'costs', label: `Gastos (${costs.length})` },
        { id: 'transfers', label: `Pagos (${transfers.length})` },
      ]} />

      {tab === 'orders' && (orders.length
        ? <Group>{orders.map(o => <OrderListRow key={o._id} order={o} showStatus onClick={() => setSelected(o)} />)}</Group>
        : <EmptyState title="Sin pedidos" />)}
      {tab === 'costs' && (costs.length
        ? <Group>{costs.map(c => <Row key={c._id} title={c.description} subtitle={`${c.paidBy ? `Pagó ${nameOf(c.paidBy)}` : 'Sin indicar quién pagó'} · ${formatDay(c.date)}`} detail={money(c.amount)} />)}</Group>
        : <EmptyState title="Sin gastos" />)}
      {tab === 'transfers' && (transfers.length
        ? <Group>{transfers.map(t => <Row key={t._id} title={`${nameOf(t.from)} → ${nameOf(t.to)}`} subtitle={[t.note, formatDay(t.date)].filter(Boolean).join(' · ')} detail={money(t.amount)} />)}</Group>
        : <EmptyState title="Sin pagos" />)}

      <OrderSheet order={selected} onClose={() => setSelected(null)} readOnly />
    </Screen>
  );
}
