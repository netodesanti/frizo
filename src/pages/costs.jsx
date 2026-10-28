import { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, Wallet } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  COMPANY, COST_CATEGORIES, categoryOf, partnerBalances, partnerFlows, settleUp, myPartnerId, sumBy,
} from '@/lib/data';
import { money, todayISO, formatDay, monthOf } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Group, Row, Cell, ButtonRow, TextField, DateRow, Segmented, AmountField, BigButton,
  IconTile, Avatar, EmptyState, NavButton, ModalSheet, useSticky,
} from '@/components/ios';

const round2 = (n) => Math.round(n * 100) / 100;
const balanceLabel = (b) => (b > 0.005 ? 'La empresa le debe' : b < -0.005 ? 'Le debe a la empresa' : 'Al día');
const balanceColor = (b) => (b > 0.005 ? 'text-success' : b < -0.005 ? 'text-destructive' : undefined);

export function CostsPage({ sub }) {
  const store = useStore();
  const { costs, transfers, partners } = store;
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null); // { kind: 'cost' | 'payment' | 'balance', item?, preset? }
  const costSheet = useSticky(sheet?.kind === 'cost' ? sheet : null);
  const paymentSheet = useSticky(sheet?.kind === 'payment' ? sheet : null);
  const balanceSheet = useSticky(sheet?.kind === 'balance' ? sheet : null);
  const close = () => setSheet(null);

  // "costs/new" (from Inicio) opens the new-expense sheet.
  useEffect(() => {
    if (sub === 'new') { setSheet({ kind: 'cost' }); navigate('costs', { replace: true }); }
  }, [sub]);

  const payers = [COMPANY, ...partners];
  const nameOf = (id) => payers.find(p => p.id === id)?.name || (id ? 'Socio eliminado' : 'Sin indicar');
  const balances = partnerBalances(partners, costs, transfers);
  const settlements = partners.length > 1 ? settleUp(partners, balances) : [];

  const feed = [
    ...costs.map(c => ({ kind: 'cost', item: c })),
    ...transfers.map(t => ({ kind: 'payment', item: t })),
  ]
    .filter(({ kind, item }) => filter === 'all'
      || (kind === 'cost' ? item.paidBy === filter : item.from === filter || item.to === filter))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || (b.item.createdAt || '').localeCompare(a.item.createdAt || ''));
  const months = [];
  for (const entry of feed) {
    const m = monthOf(entry.item.date);
    if (months.at(-1)?.month !== m) months.push({ month: m, entries: [] });
    months.at(-1).entries.push(entry);
  }

  const removeCost = (c) => {
    if (!window.confirm(`¿Eliminar el gasto "${c.description}"?`)) return;
    store.deleteCost(c._id); close();
  };
  const removePayment = (t) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    store.deleteTransfer(t._id); close();
  };

  return (
    <Screen title="Gastos" subtitle={`${money(sumBy(costs, c => c.amount))} gastados en total`}
      actions={<NavButton icon={Plus} label="Nuevo gasto" onClick={() => setSheet({ kind: 'cost' })} />}>

      {partners.length === 0 ? (
        <Group header="Saldos" footer="Agregá a los socios para registrar quién pagó cada gasto y ver cuánto se le debe a cada uno.">
          <ButtonRow onClick={() => navigate('settings/partners')}>Agregar socios</ButtonRow>
        </Group>
      ) : (
        <Group header="Saldos"
          footer={settlements.length > 0 && `Si se reparten los gastos en partes iguales: ${settlements.map(s => `${s.from.name} le debe ${money(s.amount)} a ${s.to.name}`).join('; ')}.`}>
          {partners.map(p => (
            <Row key={p.id} leading={<Avatar name={p.name} />} title={p.name} subtitle={balanceLabel(balances[p.id])}
              detail={money(Math.abs(balances[p.id]))} detailClassName={cn('font-semibold', balanceColor(balances[p.id]))}
              chevron onClick={() => setSheet({ kind: 'balance', item: p })} />
          ))}
          <ButtonRow icon={ArrowLeftRight} onClick={() => setSheet({ kind: 'payment' })}>Registrar pago o reembolso</ButtonRow>
        </Group>
      )}

      {partners.length > 0 && (costs.length > 0 || transfers.length > 0) && (
        <Segmented value={filter} onChange={setFilter}
          options={[{ id: 'all', label: 'Todo' }, ...partners.map(p => ({ id: p.id, label: p.name })), { id: COMPANY.id, label: COMPANY.name }]} />
      )}

      {months.length === 0 ? (
        <EmptyState icon={Wallet} title={filter === 'all' ? 'Sin gastos todavía' : 'Nada con este filtro'}
          action={filter === 'all' && <BigButton onClick={() => setSheet({ kind: 'cost' })}><Plus /> Agregar gasto</BigButton>}>
          {filter === 'all' && 'Registrá cada compra y quién la pagó; los saldos se calculan solos.'}
        </EmptyState>
      ) : months.map(({ month, entries }) => (
        <Group key={month} header={
          <span className="flex justify-between">
            <span>{month}</span>
            <span className="tabular-nums">{money(sumBy(entries.filter(e => e.kind === 'cost'), e => e.item.amount))}</span>
          </span>
        }>
          {entries.map(({ kind, item }) => kind === 'cost' ? (
            <Row key={item._id} leading={<IconTile icon={categoryOf(item.category).icon} color={categoryOf(item.category).color} size={32} />}
              title={item.description}
              subtitle={<span className={cn(!item.paidBy && 'text-warning')}>{item.paidBy ? `Pagó ${nameOf(item.paidBy)}` : 'Sin indicar quién pagó'} · {formatDay(item.date)}</span>}
              detail={money(item.amount)} detailClassName="text-foreground"
              onClick={() => setSheet({ kind: 'cost', item })} />
          ) : (
            <Row key={item._id} leading={<IconTile icon={ArrowLeftRight} color="#5856d6" size={32} />}
              title={`${nameOf(item.from)} → ${nameOf(item.to)}`}
              subtitle={[item.note, formatDay(item.date)].filter(Boolean).join(' · ')}
              detail={money(item.amount)}
              onClick={() => setSheet({ kind: 'payment', item })} />
          ))}
        </Group>
      ))}

      <ModalSheet open={sheet?.kind === 'cost'} onOpenChange={v => !v && close()}
        title={costSheet?.item ? 'Editar gasto' : 'Nuevo gasto'}
        confirm={{ label: costSheet?.item ? 'Guardar' : 'Agregar', form: 'cost-form' }}>
        {costSheet && (
          <CostForm cost={costSheet.item} payers={payers} partners={partners}
            onDelete={costSheet.item && (() => removeCost(costSheet.item))}
            onSubmit={data => {
              if (costSheet.item) store.editCost(costSheet.item._id, data);
              else store.addCost({ ...data, createdAt: new Date().toISOString() });
              close();
            }} />
        )}
      </ModalSheet>

      <ModalSheet open={sheet?.kind === 'payment'} onOpenChange={v => !v && close()}
        title={paymentSheet?.item ? 'Editar pago' : 'Registrar pago'}
        confirm={{ label: 'Guardar', form: 'payment-form' }}>
        {paymentSheet && (
          <PaymentForm transfer={paymentSheet.item} preset={paymentSheet.preset} payers={payers} partners={partners} nameOf={nameOf}
            onDelete={paymentSheet.item && (() => removePayment(paymentSheet.item))}
            onSubmit={data => {
              if (paymentSheet.item) store.editTransfer(paymentSheet.item._id, data);
              else store.addTransfer({ ...data, createdAt: new Date().toISOString() });
              close();
            }} />
        )}
      </ModalSheet>

      <ModalSheet open={sheet?.kind === 'balance'} onOpenChange={v => !v && close()}
        title={balanceSheet?.item.name} cancel={null} confirm={{ label: 'Listo', onClick: close }}>
        {balanceSheet && (
          <BalanceDetail partner={balanceSheet.item} balance={balances[balanceSheet.item.id] || 0}
            flows={partnerFlows(balanceSheet.item.id, costs, transfers)}
            onSettle={preset => setSheet({ kind: 'payment', preset })} />
        )}
      </ModalSheet>
    </Screen>
  );
}

function CostForm({ cost, payers, partners, onSubmit, onDelete }) {
  const [amount, setAmount] = useState(cost ? String(cost.amount) : '');
  const [description, setDescription] = useState(cost?.description || '');
  const [paidBy, setPaidBy] = useState(cost ? cost.paidBy || '' : myPartnerId(partners) || COMPANY.id);
  const [category, setCategory] = useState(cost?.category || 'ingredientes');
  const [date, setDate] = useState(cost ? cost.date.slice(0, 10) : todayISO());
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { setError('Escribí el monto'); return; }
    if (!description.trim()) { setError('Escribí en qué se gastó'); return; }
    if (!paidBy) { setError('Indicá quién pagó'); return; }
    onSubmit({ description: description.trim(), amount: amt, category, paidBy, date: new Date(date).toISOString() });
  };

  return (
    <form id="cost-form" onSubmit={submit} className="space-y-6">
      <AmountField value={amount} onChange={v => { setAmount(v); setError(''); }} autoFocus={!cost} />
      <Group>
        <TextField placeholder="¿En qué se gastó?" value={description} onChange={e => { setDescription(e.target.value); setError(''); }} />
      </Group>
      <Group header="¿Quién pagó?" footer={payers.length === 1 && 'Agregá socios en Ajustes para indicar quién pagó cada gasto.'}>
        <Cell className="py-2.5">
          <Segmented value={paidBy} onChange={setPaidBy} options={payers.map(p => ({ id: p.id, label: p.name }))} />
        </Cell>
      </Group>
      <Group header="Categoría">
        <Cell className="py-3">
          <div className="grid grid-cols-3 gap-2">
            {COST_CATEGORIES.map(c => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                className={cn('flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium transition-colors',
                  category === c.id ? 'bg-primary/12 text-primary ring-2 ring-primary' : 'bg-segment')}>
                <IconTile icon={c.icon} color={c.color} size={28} />
                {c.label}
              </button>
            ))}
          </div>
        </Cell>
      </Group>
      <Group><DateRow label="Fecha" value={date} onChange={setDate} /></Group>
      {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
      {onDelete && <Group><ButtonRow destructive center onClick={onDelete}>Eliminar gasto</ButtonRow></Group>}
    </form>
  );
}

function PaymentForm({ transfer, preset, payers, partners, nameOf, onSubmit, onDelete }) {
  const [amount, setAmount] = useState(transfer ? String(transfer.amount) : preset ? String(round2(preset.amount)) : '');
  const [from, setFrom] = useState(transfer?.from || preset?.from || COMPANY.id);
  const [to, setTo] = useState(transfer?.to || preset?.to || myPartnerId(partners) || partners[0]?.id || '');
  const [note, setNote] = useState(transfer?.note || '');
  const [date, setDate] = useState(transfer ? transfer.date.slice(0, 10) : todayISO());
  const [error, setError] = useState('');
  const amt = parseFloat(amount) || 0;
  const options = payers.map(p => ({ id: p.id, label: p.name }));

  const submit = (e) => {
    e.preventDefault();
    if (amt <= 0) { setError('Escribí el monto'); return; }
    if (from === to) { setError('Elegí dos personas distintas'); return; }
    onSubmit({ from, to, amount: amt, note: note.trim(), date: new Date(date).toISOString() });
  };

  return (
    <form id="payment-form" onSubmit={submit} className="space-y-6">
      <AmountField value={amount} onChange={v => { setAmount(v); setError(''); }} autoFocus={!transfer && !preset} />
      <Group header="Pagó">
        <Cell className="py-2.5"><Segmented value={from} onChange={v => { setFrom(v); setError(''); }} options={options} /></Cell>
      </Group>
      <Group header="Recibió"
        footer={from !== to && (
          <>
            {nameOf(from)} le pagó {money(amt)} a {nameOf(to)}.
            {from === COMPANY.id && ' Usalo para reembolsos o para la plata de ventas que se queda un socio.'}
          </>
        )}>
        <Cell className="py-2.5"><Segmented value={to} onChange={v => { setTo(v); setError(''); }} options={options} /></Cell>
      </Group>
      <Group>
        <TextField placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} />
        <DateRow label="Fecha" value={date} onChange={setDate} />
      </Group>
      {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
      {onDelete && <Group><ButtonRow destructive center onClick={onDelete}>Eliminar pago</ButtonRow></Group>}
    </form>
  );
}

function BalanceDetail({ partner, balance, flows, onSettle }) {
  return (
    <>
      <div className="flex flex-col items-center pt-2 text-center">
        <Avatar name={partner.name} size={64} />
        <div className="mt-3 text-[15px] text-muted-foreground">{balanceLabel(balance)}</div>
        <div className={cn('text-[44px] font-bold leading-tight tabular-nums tracking-tight', balanceColor(balance))}>{money(Math.abs(balance))}</div>
      </div>
      <Group footer="El saldo es lo que pagó de su bolsillo más los pagos que hizo, menos los pagos que recibió.">
        <Row title="Gastos que pagó" detail={money(flows.paidCosts)} />
        <Row title="Pagos que hizo" detail={money(flows.sent)} />
        <Row title="Pagos que recibió" detail={`− ${money(flows.received)}`} />
      </Group>
      {balance > 0.005 && (
        <BigButton onClick={() => onSettle({ from: COMPANY.id, to: partner.id, amount: balance })}>
          Registrar reembolso de {money(balance)}
        </BigButton>
      )}
      {balance < -0.005 && (
        <BigButton onClick={() => onSettle({ from: partner.id, to: COMPANY.id, amount: -balance })}>
          Registrar devolución de {money(-balance)}
        </BigButton>
      )}
    </>
  );
}
