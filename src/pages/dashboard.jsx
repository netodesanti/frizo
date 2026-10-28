import { useState } from 'react';
import { ChevronDown, HandCoins, PlusCircle, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { useStore } from '@/lib/store';
import { summarize, partnerBalances, myPartnerId, orderTotal, sumBy } from '@/lib/data';
import { money } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Section, Stack, Card, ListItem, StatTile, Chips, Avatar, FlavorTile, Tag, PillButton, LinkButton, EmptyState, useCountUp,
} from '@/components/kit';
import { OrderCard, OrderSheet } from '@/components/orders';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

const RANGES = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'all', label: 'Todo' },
];

const localDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const startOf = (range) => {
  if (range === 'all') return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (range === 'month') d.setDate(1);
  return d;
};

// Sales (non-cancelled orders) for each of the last 7 days.
function lastWeek(orders) {
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6 + i); return d; });
  return days.map(d => ({
    label: d.toLocaleDateString('es', { weekday: 'narrow' }),
    total: sumBy(orders.filter(o => o.status !== 'cancelado' && localDay(new Date(o.date)) === localDay(d)), orderTotal),
  }));
}

function Hero({ summary, rangeLabel, week }) {
  const profit = useCountUp(summary.profit);
  const max = Math.max(...week.map(d => d.total), 1);
  return (
    <div className="grain overflow-hidden rounded-[30px] bg-primary p-5 text-white shadow-float">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white/60">Ganancia · {rangeLabel}</div>
          <div className="mt-1 truncate font-display text-[44px] font-bold leading-none tracking-tight text-brand-lime tabular-nums">
            {money(Math.round(profit))}
          </div>
        </div>
        <div className="flex h-16 shrink-0 items-end gap-1.5" aria-label="Ventas de los últimos 7 días">
          {week.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-2.5 items-end overflow-hidden rounded-full bg-white/10">
                <div className={cn('w-full rounded-full transition-all duration-700', i === 6 ? 'bg-brand-lime' : 'bg-brand-lime/45')}
                  style={{ height: `${Math.max(8, (d.total / max) * 100)}%` }} />
              </div>
              <span className="text-[10px] font-semibold uppercase text-white/50">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/10 px-3.5 py-2.5">
          <div className="text-[12px] text-white/60">Cobrado</div>
          <div className="font-display text-[18px] font-bold tabular-nums">{money(summary.paid)}</div>
        </div>
        <div className="rounded-2xl bg-white/10 px-3.5 py-2.5">
          <div className="text-[12px] text-white/60">Gastos</div>
          <div className="font-display text-[18px] font-bold tabular-nums">{money(summary.spent)}</div>
        </div>
      </div>
    </div>
  );
}

function CountTile({ value, format = (v) => Math.round(v), ...props }) {
  const v = useCountUp(value);
  return <StatTile value={format(v)} {...props} />;
}

export function DashboardPage() {
  const { orders, costs, transfers, partners, stock, flavors } = useStore();
  const [range, setRange] = useState('month');
  const [queue, setQueue] = useState('pendiente');
  const [selected, setSelected] = useState(null);

  const start = startOf(range);
  const rangeOrders = start ? orders.filter(o => new Date(o.date) >= start) : orders;
  const rangeCosts = start ? costs.filter(c => c.date.slice(0, 10) >= localDay(start)) : costs;
  const summary = summarize(rangeOrders, rangeCosts);
  const rangeLabel = RANGES.find(r => r.id === range).label;

  const open = orders.filter(o => ['pendiente', 'preparando'].includes(o.status || 'pendiente'));
  const unpaid = orders.filter(o => !['pagado', 'cancelado'].includes(o.status));
  const queued = orders.filter(o => (o.status || 'pendiente') === queue);
  const balances = partnerBalances(partners, costs, transfers);
  const me = partners.find(p => p.id === myPartnerId(partners));

  return (
    <Screen title="Resumen" eyebrow={`Hola${me ? `, ${me.name}` : ''} 👋`} wide actions={
      <DropdownMenu>
        <DropdownMenuTrigger asChild><PillButton>{rangeLabel} <ChevronDown className="size-4" /></PillButton></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40 rounded-2xl p-1.5">
          {RANGES.map(r => <DropdownMenuItem key={r.id} onSelect={() => setRange(r.id)} className="rounded-xl py-2 text-[15px]">{r.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    }>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Hero summary={summary} rangeLabel={rangeLabel} week={lastWeek(orders)} />
        <div className="grid grid-cols-2 gap-3">
          <CountTile icon={Truck} tone="butter" label="Por entregar" value={open.length} unit="pedidos" onClick={() => navigate('orders')} />
          <CountTile icon={HandCoins} tone="blush" label="Por cobrar" value={sumBy(unpaid, orderTotal)} format={v => money(Math.round(v))}
            unit={`${unpaid.length} pedido${unpaid.length !== 1 ? 's' : ''}`} onClick={() => navigate('orders')} />
          <CountTile icon={ShoppingBag} tone="mint" label="Vendidas" value={summary.bags} unit={`bolsas · ${rangeLabel.toLowerCase()}`} />
          <Card onClick={() => navigate('orders/new')} className="grain relative flex min-h-40 flex-col overflow-hidden bg-brand-lime p-4 text-brand-green shadow-none">
            <PlusCircle className="size-7" strokeWidth={2.2} />
            <div className="mt-3 font-display text-[22px] font-bold leading-tight">Nuevo<br />pedido</div>
            <span className="pointer-events-none absolute -bottom-3 -right-2 rotate-12 text-[76px] leading-none drop-shadow-lg">🥤</span>
          </Card>
        </div>
      </div>

      <ListItem icon={Wallet} tone="peach" title="¿Gastaste algo?" subtitle="Registrá un gasto en segundos" chevron onClick={() => navigate('costs/new')} />

      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-2 md:gap-6">
        <Section title="Por entregar" action={<LinkButton onClick={() => navigate('orders')}>Ver todos</LinkButton>}>
          <Chips value={queue} onChange={setQueue} options={[
            { id: 'pendiente', label: 'Pendientes', count: orders.filter(o => (o.status || 'pendiente') === 'pendiente').length },
            { id: 'preparando', label: 'Preparando', count: orders.filter(o => o.status === 'preparando').length },
          ]} />
          {queued.length === 0
            ? <EmptyState emoji="🎉" title="Todo al día">No hay pedidos {queue === 'pendiente' ? 'pendientes' : 'en preparación'}.</EmptyState>
            : <Stack>{queued.slice(0, 5).map(o => <OrderCard key={o._id} order={o} showStatus={false} onClick={() => setSelected(o)} />)}</Stack>}
        </Section>

        <div className="space-y-7">
          <Section title="Inventario" action={<LinkButton onClick={() => navigate('products')}>Ajustar</LinkButton>}>
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:px-0">
              {flavors.map(f => {
                const n = stock[f.id] || 0;
                return (
                  <Card key={f.id} onClick={() => navigate('products')} className="w-36 shrink-0 p-4 md:w-auto">
                    <FlavorTile flavor={f} size={48} />
                    <div className="mt-3 truncate text-[14px] font-semibold">{f.name}</div>
                    <div className={cn('font-display text-[30px] font-bold leading-tight tabular-nums', n <= 0 && 'text-destructive')}>{n}</div>
                    {n <= 3 ? <Tag tone="blush">{n <= 0 ? 'Agotado' : 'Poco stock'}</Tag> : <span className="text-[12px] text-muted-foreground">bolsas</span>}
                  </Card>
                );
              })}
            </div>
          </Section>

          {partners.length > 0 && (
            <Section title="Saldos" action={<LinkButton onClick={() => navigate('costs')}>Gastos</LinkButton>}>
              <div className="grid grid-cols-2 gap-3">
                {partners.map(p => {
                  const b = balances[p.id];
                  return (
                    <Card key={p.id} onClick={() => navigate('costs')} className="p-4">
                      <Avatar name={p.name} size={40} />
                      <div className="mt-3 truncate text-[15px] font-semibold">{p.name}</div>
                      <div className="text-[12px] text-muted-foreground">{b > 0.005 ? 'La empresa le debe' : b < -0.005 ? 'Le debe a la empresa' : 'Al día'}</div>
                      <div className={cn('mt-1 truncate font-display text-[22px] font-bold tabular-nums', b > 0.005 ? 'text-success' : b < -0.005 ? 'text-destructive' : '')}>
                        {money(Math.abs(b))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>

      <OrderSheet order={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
