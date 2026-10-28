import { useState } from 'react';
import { FileSpreadsheet, Plus, Route } from 'lucide-react';
import { useStore } from '@/lib/store';
import { newId, statusOf } from '@/lib/data';
import { navigate, goBack } from '@/lib/nav';
import { Screen, Section, Stack, IconButton, Chips, SearchField, EmptyState, Button } from '@/components/kit';
import { OrderForm, OrderCard, OrderSheet } from '@/components/orders';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

const ACTIVE = ['pendiente', 'preparando', 'entregado'];
const FILTERS = [
  { id: 'active', label: 'Activos', statuses: ACTIVE },
  ...['pendiente', 'preparando', 'entregado', 'pagado', 'cancelado'].map(s => ({ id: s, label: statusOf(s).label, statuses: [s] })),
];

export function OrdersPage() {
  const { orders } = useStore();
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const q = search.trim().toLowerCase();
  const matches = orders.filter(o => !q || [o.customer, o.location, o.notes].some(v => v?.toLowerCase().includes(q)));
  const current = FILTERS.find(f => f.id === filter);
  const sections = current.statuses
    .map(s => ({ status: s, items: matches.filter(o => (o.status || 'pendiente') === s) }))
    .filter(s => s.items.length);

  return (
    <Screen title="Pedidos" eyebrow={`${orders.filter(o => ACTIVE.includes(o.status || 'pendiente')).length} activos`} actions={
      <>
        <IconButton icon={Route} label="Rutas" onClick={() => navigate('orders/routes')} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton icon={Plus} label="Nuevo" dark /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-1.5">
            <DropdownMenuItem onSelect={() => navigate('orders/new')} className="rounded-xl py-2.5 text-[15px]"><Plus /> Nuevo pedido</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('orders/bulk')} className="rounded-xl py-2.5 text-[15px]"><FileSpreadsheet /> Importar desde Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    }>
      <div className="space-y-3">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar cliente o dirección" />
        <Chips value={filter} onChange={setFilter}
          options={FILTERS.map(f => ({ id: f.id, label: f.label, count: matches.filter(o => f.statuses.includes(o.status || 'pendiente')).length }))} />
      </div>

      {sections.length === 0 ? (
        <EmptyState emoji={q ? '🔍' : '📋'} title={q ? 'Sin resultados' : 'Nada por acá'}
          action={!q && filter === 'active' && <Button onClick={() => navigate('orders/new')}><Plus /> Nuevo pedido</Button>}>
          {q ? `Nada coincide con “${search}”.` : 'Cuando entren pedidos los vas a ver acá.'}
        </EmptyState>
      ) : sections.map(s => (
        <Section key={s.status} title={current.statuses.length > 1 ? `${statusOf(s.status).label} · ${s.items.length}` : undefined}>
          <Stack>{s.items.map(o => <OrderCard key={o._id} order={o} showStatus={current.statuses.length === 1} onClick={() => setSelected(o)} />)}</Stack>
        </Section>
      ))}

      <OrderSheet order={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

export function NewOrderPage() {
  const { placeOrder } = useStore();
  const create = (data) => {
    placeOrder({ ...data, id: newId(), status: 'pendiente', date: new Date().toISOString() });
    navigate('orders', { replace: true });
  };

  return (
    <Screen title="Nuevo pedido" back={{ label: 'Pedidos', onClick: () => goBack('orders') }}>
      <OrderForm id="new-order" onSubmit={create}>
        <Button type="submit">Crear pedido</Button>
      </OrderForm>
    </Screen>
  );
}
