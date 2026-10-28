import { useEffect, useState } from 'react';
import { ArrowLeftRight, ChevronRight, Plus, Sparkles, Users } from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  COMPANY, COST_CATEGORIES, categoryOf, partnerBalances, partnerFlows, settleUp, myPartnerId, sumBy,
} from '@/lib/data';
import { money, todayISO, formatDay, monthOf } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  TONES, Screen, Section, Stack, Card, ListItem, ToneIcon, Chips, Avatar, IconButton, PillButton, Button,
  TextField, DateField, AmountField, EmptyState, Sheet, useSticky,
} from '@/components/kit';

const round2 = (n) => Math.round(n * 100) / 100;
const balanceLabel = (b) => (b > 0.005 ? 'La empresa le debe' : b < -0.005 ? 'Le debe a la empresa' : 'Al día');
const balanceColor = (b) => (b > 0.005 ? 'text-success' : b < -0.005 ? 'text-destructive' : 'text-foreground/40');

export function CostsPage({ sub }) {
  const store = useStore();
  const { costs, transfers, partners } = store;
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null); // { kind: 'cost' | 'payment' | 'balance', item?, preset? }
  const costSheet = useSticky(sheet?.kind === 'cost' ? sheet : null);
  const paymentSheet = useSticky(sheet?.kind === 'payment' ? sheet : null);
  const balanceSheet = useSticky(sheet?.kind === 'balance' ? sheet : null);
  const close = () => setSheet(null);

  // "costs/new" (from Resumen) opens the new-expense sheet.
  useEffect(() => {
    if (sub === 'new') { setSheet({ kind: 'cost' }); navigate('costs', { replace: true }); }
  }, [sub]);

  const payers = [COMPANY, ...partners];
  const nameOf = (id) => payers.find(p => p.id === id)?.name || (id ? 'Socio eliminado' : 'Sin indicar');
  const balances = partnerBalances(partners, costs, transfers);
  const settlements = partners.length > 1 ? settleUp(partners, balances) : [];
  const total = sumBy(costs, c => c.amount);
  const byCategory = COST_CATEGORIES
    .map(c => ({ ...c, total: sumBy(costs.filter(x => categoryOf(x.category).id === c.id), x => x.amount) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

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
    <Screen title="Gastos" eyebrow={`${money(total)} gastados`}
      actions={<IconButton icon={Plus} label="Nuevo gasto" dark onClick={() => setSheet({ kind: 'cost' })} />}>

      {partners.length === 0 ? (
        <ListItem icon={Users} tone="sky" title="Agregá a los socios" subtitle="Para saber quién pagó qué y cuánto se le debe a cada uno"
          chevron onClick={() => navigate('settings/partners')} />
      ) : (
        <Section title="Saldos">
          <div className="grid grid-cols-2 gap-3">
            {partners.map(p => {
              const b = balances[p.id];
              return (
                <Card key={p.id} onClick={() => setSheet({ kind: 'balance', item: p })} className="flex flex-col p-4">
                  <div className="flex items-center justify-between">
                    <Avatar name={p.name} size={40} />
                    <span className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-foreground/80">
                      <ChevronRight className="size-4" strokeWidth={2.5} />
                    </span>
                  </div>
                  <div className="mt-3 truncate text-[15px] font-semibold">{p.name}</div>
                  <div className="text-[12px] text-muted-foreground">{balanceLabel(b)}</div>
                  <div className={cn('mt-1 truncate font-display text-[26px] font-bold leading-tight tabular-nums', balanceColor(b))}>{money(Math.abs(b))}</div>
                </Card>
              );
            })}
          </div>
          {partners.length > 1 && (
            <Card tone="lilac" className="flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/70" style={{ color: TONES.lilac.fg }}>
                {settlements.length ? <ArrowLeftRight className="size-5" /> : <Sparkles className="size-5" />}
              </span>
              <div className="min-w-0 flex-1 text-[14px]">
                {settlements.length
                  ? settlements.map((s, i) => <div key={i}><b>{s.from.name}</b> le debe <b>{money(s.amount)}</b> a <b>{s.to.name}</b></div>)
                  : <b>Están parejos</b>}
                <div className="text-[12px] text-foreground/55">Repartiendo los gastos en partes iguales</div>
              </div>
              <PillButton onClick={() => setSheet({ kind: 'payment', preset: settlements[0] && { from: settlements[0].from.id, to: settlements[0].to.id, amount: settlements[0].amount } })}>
                Pagar
              </PillButton>
            </Card>
          )}
        </Section>
      )}

      {byCategory.length > 0 && (
        <Card className="space-y-4 p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[18px] font-bold">En qué se va la plata</span>
            <span className="font-display text-[18px] font-bold tabular-nums">{money(total)}</span>
          </div>
          <div className="flex h-3 gap-1 overflow-hidden rounded-full">
            {byCategory.map(c => <span key={c.id} className="h-full rounded-full" style={{ width: `${(c.total / total) * 100}%`, backgroundColor: TONES[c.tone].fg }} />)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {byCategory.map(c => (
              <span key={c.id} className="flex items-center gap-1.5 text-[13px]">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: TONES[c.tone].fg }} />
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground tabular-nums">{Math.round((c.total / total) * 100)}%</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {partners.length > 0 && (costs.length > 0 || transfers.length > 0) && (
        <Chips value={filter} onChange={setFilter}
          options={[{ id: 'all', label: 'Todo' }, ...partners.map(p => ({ id: p.id, label: p.name })), { id: COMPANY.id, label: COMPANY.name }]} />
      )}

      {months.length === 0 ? (
        <EmptyState emoji="🧾" title={filter === 'all' ? 'Sin gastos todavía' : 'Nada con este filtro'}
          action={filter === 'all' && <Button onClick={() => setSheet({ kind: 'cost' })}><Plus /> Agregar gasto</Button>}>
          {filter === 'all' && 'Registrá cada compra y quién la pagó; los saldos se calculan solos.'}
        </EmptyState>
      ) : months.map(({ month, entries }) => (
        <Section key={month} title={month}
          action={<span className="text-[14px] font-semibold text-muted-foreground tabular-nums">{money(sumBy(entries.filter(e => e.kind === 'cost'), e => e.item.amount))}</span>}>
          <Stack>
            {entries.map(({ kind, item }) => kind === 'cost' ? (
              <ListItem key={item._id} icon={categoryOf(item.category).icon} tone={categoryOf(item.category).tone}
                title={item.description}
                subtitle={<span className={cn(!item.paidBy && 'font-semibold text-warning')}>{item.paidBy ? `Pagó ${nameOf(item.paidBy)}` : 'Sin indicar quién pagó'} · {formatDay(item.date)}</span>}
                trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums">{money(item.amount)}</span>}
                onClick={() => setSheet({ kind: 'cost', item })} />
            ) : (
              <ListItem key={item._id} icon={ArrowLeftRight} tone="lilac"
                title={`${nameOf(item.from)} → ${nameOf(item.to)}`}
                subtitle={[item.note, formatDay(item.date)].filter(Boolean).join(' · ')}
                trailing={<span className="shrink-0 font-display text-[17px] font-bold tabular-nums text-muted-foreground">{money(item.amount)}</span>}
                onClick={() => setSheet({ kind: 'payment', item })} />
            ))}
          </Stack>
        </Section>
      ))}

      <Sheet open={sheet?.kind === 'cost'} onOpenChange={v => !v && close()}
        title={costSheet?.item ? 'Editar gasto' : 'Nuevo gasto'}
        confirm={{ label: costSheet?.item ? 'Guardar cambios' : 'Agregar gasto', form: 'cost-form' }}>
        {costSheet && (
          <CostForm cost={costSheet.item} payers={payers} partners={partners}
            onDelete={costSheet.item && (() => removeCost(costSheet.item))}
            onSubmit={data => {
              if (costSheet.item) store.editCost(costSheet.item._id, data);
              else store.addCost({ ...data, createdAt: new Date().toISOString() });
              close();
            }} />
        )}
      </Sheet>

      <Sheet open={sheet?.kind === 'payment'} onOpenChange={v => !v && close()}
        title={paymentSheet?.item ? 'Editar pago' : 'Registrar pago'}
        confirm={{ label: 'Guardar pago', form: 'payment-form' }}>
        {paymentSheet && (
          <PaymentForm transfer={paymentSheet.item} preset={paymentSheet.preset} payers={payers} partners={partners} nameOf={nameOf}
            onDelete={paymentSheet.item && (() => removePayment(paymentSheet.item))}
            onSubmit={data => {
              if (paymentSheet.item) store.editTransfer(paymentSheet.item._id, data);
              else store.addTransfer({ ...data, createdAt: new Date().toISOString() });
              close();
            }} />
        )}
      </Sheet>

      <Sheet open={sheet?.kind === 'balance'} onOpenChange={v => !v && close()} title={balanceSheet?.item.name}>
        {balanceSheet && (
          <BalanceDetail partner={balanceSheet.item} balance={balances[balanceSheet.item.id] || 0}
            flows={partnerFlows(balanceSheet.item.id, costs, transfers)}
            onSettle={preset => setSheet({ kind: 'payment', preset })} />
        )}
      </Sheet>
    </Screen>
  );
}

function FieldLabel({ children }) {
  return <div className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">{children}</div>;
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
    <form id="cost-form" onSubmit={submit} className="space-y-5">
      <AmountField value={amount} onChange={v => { setAmount(v); setError(''); }} autoFocus={!cost} />
      <TextField label="Descripción" placeholder="¿En qué se gastó?" value={description} onChange={e => { setDescription(e.target.value); setError(''); }} />
      <div>
        <FieldLabel>¿Quién pagó?</FieldLabel>
        <Chips value={paidBy} onChange={setPaidBy} options={payers.map(p => ({ id: p.id, label: p.name }))} className="-mx-5 px-5" />
        {payers.length === 1 && <p className="px-1 pt-2 text-[12px] text-muted-foreground">Agregá socios en Ajustes para indicar quién pagó.</p>}
      </div>
      <div>
        <FieldLabel>Categoría</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {COST_CATEGORIES.map(c => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)}
              className={cn('flex flex-col items-center gap-1.5 rounded-[20px] py-3 text-[13px] font-semibold transition-all duration-150 active:scale-95',
                category === c.id ? 'ring-2 ring-primary' : '')}
              style={{ backgroundColor: TONES[c.tone].bg, color: category === c.id ? TONES[c.tone].fg : undefined }}>
              <c.icon className="size-6" style={{ color: TONES[c.tone].fg }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <DateField label="Fecha" value={date} onChange={setDate} />
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
      {onDelete && <Button type="button" variant="danger" onClick={onDelete}>Eliminar gasto</Button>}
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
    <form id="payment-form" onSubmit={submit} className="space-y-5">
      <AmountField value={amount} onChange={v => { setAmount(v); setError(''); }} autoFocus={!transfer && !preset} />
      <div>
        <FieldLabel>Pagó</FieldLabel>
        <Chips value={from} onChange={v => { setFrom(v); setError(''); }} options={options} className="-mx-5 px-5" />
      </div>
      <div>
        <FieldLabel>Recibió</FieldLabel>
        <Chips value={to} onChange={v => { setTo(v); setError(''); }} options={options} className="-mx-5 px-5" />
      </div>
      {from !== to && (
        <Card tone="lilac" className="flex items-center gap-3 p-4 text-[14px]">
          <ToneIcon icon={ArrowLeftRight} tone="lilac" size={36} />
          <div>
            <b>{nameOf(from)}</b> le pagó <b>{money(amt)}</b> a <b>{nameOf(to)}</b>.
            {from === COMPANY.id && <div className="text-[12px] text-foreground/55">Para reembolsos o plata de ventas que se queda un socio.</div>}
          </div>
        </Card>
      )}
      <TextField label="Nota" placeholder="Opcional, ej. SINPE" value={note} onChange={e => setNote(e.target.value)} />
      <DateField label="Fecha" value={date} onChange={setDate} />
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
      {onDelete && <Button type="button" variant="danger" onClick={onDelete}>Eliminar pago</Button>}
    </form>
  );
}

function BalanceDetail({ partner, balance, flows, onSettle }) {
  return (
    <>
      <div className="flex flex-col items-center pt-1 text-center">
        <Avatar name={partner.name} size={76} className="ring-4 ring-white shadow-soft" />
        <div className="mt-3 text-[14px] font-medium text-muted-foreground">{balanceLabel(balance)}</div>
        <div className={cn('font-display text-[48px] font-bold leading-tight tracking-tight tabular-nums', balanceColor(balance))}>{money(Math.abs(balance))}</div>
      </div>
      <Stack>
        <ListItem icon={Plus} tone="mint" title="Gastos que pagó" trailing={<b className="font-display text-[17px]">{money(flows.paidCosts)}</b>} />
        <ListItem icon={ArrowLeftRight} tone="sky" title="Pagos que hizo" trailing={<b className="font-display text-[17px]">{money(flows.sent)}</b>} />
        <ListItem icon={ArrowLeftRight} tone="blush" title="Pagos que recibió" trailing={<b className="font-display text-[17px]">− {money(flows.received)}</b>} />
      </Stack>
      <p className="px-1 text-[13px] text-muted-foreground">El saldo es lo que pagó de su bolsillo más los pagos que hizo, menos los pagos que recibió.</p>
      {balance > 0.005 && (
        <Button onClick={() => onSettle({ from: COMPANY.id, to: partner.id, amount: balance })}>Registrar reembolso de {money(balance)}</Button>
      )}
      {balance < -0.005 && (
        <Button onClick={() => onSettle({ from: partner.id, to: COMPANY.id, amount: -balance })}>Registrar devolución de {money(-balance)}</Button>
      )}
    </>
  );
}
