import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { summarize, partnerBalances, sumQty } from '@/lib/data';
import { money, todayLong } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Screen, Group, Row, ButtonRow, BigButton, FlavorTile, Avatar } from '@/components/ios';
import { OrderListRow, OrderSheet } from '@/components/orders';

function Tile({ label, value, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className="rounded-xl bg-card p-3.5 text-left transition-colors active:bg-muted">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[22px] font-bold tabular-nums tracking-tight">{value}</div>
    </Comp>
  );
}

export function DashboardPage() {
  const { orders, costs, transfers, partners, stock, flavors } = useStore();
  const [selected, setSelected] = useState(null);
  const s = summarize(orders, costs);
  const open = orders.filter(o => ['pendiente', 'preparando'].includes(o.status || 'pendiente'));
  const balances = partnerBalances(partners, costs, transfers);
  const maxStock = Math.max(...flavors.map(f => stock[f.id] || 0), 1);

  return (
    <Screen title="Inicio" subtitle={todayLong()} wide>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-brand-lime p-5 text-brand-green">
          <div className="text-[13px] font-semibold uppercase tracking-wide opacity-75">Ganancia</div>
          <div className="mt-1 text-[44px] font-bold leading-none tabular-nums tracking-tight">{money(s.profit)}</div>
          <div className="mt-4 flex gap-8">
            <div>
              <div className="text-[13px] opacity-75">Cobrado</div>
              <div className="text-[17px] font-semibold tabular-nums">{money(s.paid)}</div>
            </div>
            <div>
              <div className="text-[13px] opacity-75">Gastos</div>
              <div className="text-[17px] font-semibold tabular-nums">{money(s.spent)}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Por entregar" value={open.length} onClick={() => navigate('orders')} />
          <Tile label="Por cobrar" value={money(s.pending)} onClick={() => navigate('orders')} />
          <Tile label="Bolsas vendidas" value={s.bags} />
          <Tile label="En stock" value={sumQty(stock)} onClick={() => navigate('products')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BigButton variant="tinted" onClick={() => navigate('orders/new')}><Plus /> Pedido</BigButton>
        <BigButton variant="tinted" onClick={() => navigate('costs/new')}><Plus /> Gasto</BigButton>
      </div>

      <div className="grid items-start gap-7 md:grid-cols-2 md:gap-6">
        <Group header="Por entregar">
          {open.length === 0
            ? <Row title="Nada pendiente" subtitle="Los pedidos nuevos aparecen acá" />
            : open.slice(0, 6).map(o => <OrderListRow key={o._id} order={o} showStatus onClick={() => setSelected(o)} />)}
          <ButtonRow onClick={() => navigate('orders')}>Ver todos los pedidos</ButtonRow>
        </Group>

        <div className="space-y-7">
          <Group header="Inventario">
            {flavors.map(f => {
              const n = stock[f.id] || 0;
              return (
                <Row key={f.id} leading={<FlavorTile flavor={f} size={32} />} title={f.name} onClick={() => navigate('products')}
                  subtitle={
                    <span className="mt-1 block h-1 w-full max-w-40 overflow-hidden rounded-full bg-segment">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, n / maxStock) * 100}%`, backgroundColor: f.color }} />
                    </span>
                  }
                  detail={n} detailClassName={cn('font-semibold', n <= 0 ? 'text-destructive' : 'text-foreground')} />
              );
            })}
          </Group>

          {partners.length > 0 && (
            <Group header="Saldos">
              {partners.map(p => {
                const b = balances[p.id];
                return (
                  <Row key={p.id} leading={<Avatar name={p.name} size={32} />} title={p.name} chevron onClick={() => navigate('costs')}
                    subtitle={b > 0.005 ? 'La empresa le debe' : b < -0.005 ? 'Le debe a la empresa' : 'Al día'}
                    detail={money(Math.abs(b))}
                    detailClassName={b > 0.005 ? 'text-success' : b < -0.005 ? 'text-destructive' : undefined} />
                );
              })}
            </Group>
          )}
        </div>
      </div>

      <OrderSheet order={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
