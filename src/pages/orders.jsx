import { useState } from 'react';
import { ClipboardList, FileSpreadsheet, Plus, Route } from 'lucide-react';
import { useStore } from '@/lib/store';
import { newId, statusOf } from '@/lib/data';
import { navigate, goBack } from '@/lib/nav';
import { Screen, Group, NavButton, Segmented, SearchField, EmptyState, BigButton } from '@/components/ios';
import { OrderForm, OrderListRow, OrderSheet } from '@/components/orders';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

const VIEWS = [
  { id: 'active', label: 'Activos', statuses: ['pendiente', 'preparando', 'entregado'] },
  { id: 'paid', label: 'Pagados', statuses: ['pagado'] },
  { id: 'cancelled', label: 'Cancelados', statuses: ['cancelado'] },
];

export function OrdersPage() {
  const { orders } = useStore();
  const [view, setView] = useState('active');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const q = search.trim().toLowerCase();
  const matches = orders.filter(o => !q || [o.customer, o.location, o.notes].some(v => v?.toLowerCase().includes(q)));
  const count = (v) => matches.filter(o => v.statuses.includes(o.status || 'pendiente')).length;
  const current = VIEWS.find(v => v.id === view);
  const sections = current.statuses
    .map(s => ({ status: s, items: matches.filter(o => (o.status || 'pendiente') === s) }))
    .filter(s => s.items.length);

  return (
    <Screen title="Pedidos" actions={
      <>
        <NavButton icon={Route} label="Rutas" onClick={() => navigate('orders/routes')} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><NavButton icon={Plus} label="Nuevo" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onSelect={() => navigate('orders/new')}><Plus /> Nuevo pedido</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('orders/bulk')}><FileSpreadsheet /> Importar desde Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    }>
      <div className="space-y-3">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar cliente o dirección" />
        <Segmented value={view} onChange={setView}
          options={VIEWS.map(v => ({ id: v.id, label: count(v) ? `${v.label} (${count(v)})` : v.label }))} />
      </div>

      {sections.length === 0 ? (
        <EmptyState icon={ClipboardList} title={q ? 'Sin resultados' : 'No hay pedidos acá'}
          action={!q && view === 'active' && <BigButton onClick={() => navigate('orders/new')}><Plus /> Nuevo pedido</BigButton>}>
          {q ? `Nada coincide con “${search}”.` : view === 'active' ? 'Los pedidos pendientes, en preparación y entregados aparecen acá.' : null}
        </EmptyState>
      ) : sections.map(s => (
        <Group key={s.status} header={current.statuses.length > 1 ? `${statusOf(s.status).label} · ${s.items.length}` : undefined}>
          {s.items.map(o => <OrderListRow key={o._id} order={o} onClick={() => setSelected(o)} />)}
        </Group>
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
    <Screen title="Nuevo pedido" back={{ label: 'Pedidos', onClick: () => goBack('orders') }}
      actions={<NavButton label="Crear" bold type="submit" form="new-order" />}>
      <OrderForm id="new-order" onSubmit={create}>
        <BigButton type="submit">Crear pedido</BigButton>
      </OrderForm>
    </Screen>
  );
}
