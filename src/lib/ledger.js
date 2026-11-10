// Pure stock and money math, kept free of Firebase and React so it can be
// tested with `npm test`. Imports here must stay relative (no "@/").

export const DEFAULT_PRICE = 1600;

const round2 = (n) => Math.round(n * 100) / 100;

export const sumBy = (list, fn) => list.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
export const sumQty = (q) => Object.values(q || {}).reduce((s, v) => s + (Number(v) || 0), 0);
// Drops zero entries.
export const cleanQty = (q) => Object.fromEntries(Object.entries(q || {}).filter(([, v]) => Number(v)));
// Returns a + sign * b for every key in either quantity map.
export const addQty = (a, b, sign = 1) => {
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = (out[k] || 0) + sign * (b[k] || 0);
  return out;
};

// ─── Orders ─────────────────────────────────────────────────────────────────
// Bags an order takes out of stock. Cancelled orders give theirs back.
export const consumed = (o) => (o.status === 'cancelado' ? {} : o.quantities || {});
export const orderTotal = (o) => o.totalPrice || (o.totalBags || 0) * DEFAULT_PRICE;
// Point-of-sale sales can be partly paid (`paidAmount`); other orders are all or nothing.
export const paidOf = (o) => (o.status === 'cancelado' ? 0
  : o.status === 'pagado' ? orderTotal(o) : Math.min(o.paidAmount || 0, orderTotal(o)));
export const owedOf = (o) => (o.status === 'cancelado' ? 0 : round2(orderTotal(o) - paidOf(o)));

export function summarize(orders, costs) {
  const live = orders.filter(o => o.status !== 'cancelado');
  const paid = sumBy(live, paidOf);
  const spent = sumBy(costs, c => c.amount);
  return {
    count: live.length,
    bags: sumBy(live, o => o.totalBags),
    paid,
    pending: sumBy(live, owedOf),
    spent,
    profit: paid - spent,
  };
}

// ─── Stock movements ────────────────────────────────────────────────────────
// Which way each side moves (+1 gains the bags, -1 loses them). "manual" is a
// hand edit of the general stock with signed quantities; "production" is a batch
// of freshly made bags; "payment" moves money, not bags.
export const MOVE_SIGNS = {
  restock: { general: -1, location: 1 },
  return:  { general: 1,  location: -1 },
  loss:    { general: 0,  location: -1 },
  adjust:  { general: 0,  location: 1 },
  manual:  { general: 1,  location: 0 },
  production: { general: 1, location: 0 },
  payment: { general: 0,  location: 0 },
};
const signsOf = (type) => MOVE_SIGNS[type] || MOVE_SIGNS.adjust;

// Bag changes a movement makes on each side; sign -1 undoes it.
export function movementDelta(m, sign = 1) {
  const t = signsOf(m.type);
  return {
    general: t.general ? addQty({}, m.quantities, sign * t.general) : {},
    location: t.location && m.locationId ? addQty({}, m.quantities, sign * t.location) : {},
  };
}

// A count of what's left at a point of sale: what's missing was sold, any
// surplus is an adjustment.
export function countResult(stock, counted) {
  const sold = {}, surplus = {};
  for (const [k, n] of Object.entries(counted)) {
    const diff = (stock?.[k] || 0) - n;
    if (diff > 0) sold[k] = diff;
    if (diff < 0) surplus[k] = -diff;
  }
  return { sold, surplus };
}

// ─── Payments ───────────────────────────────────────────────────────────────
// Spreads a payment over unpaid sales, oldest first. Returns one entry per sale
// it touches: how much goes to it and whether that settles it.
export function allocatePayment(sales, amount) {
  const open = sales.filter(o => owedOf(o) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  let left = round2(amount);
  for (const o of open) {
    if (left <= 0) break;
    const owed = owedOf(o);
    const take = Math.min(owed, left);
    out.push({ id: o._id, amount: round2(take), paidAmount: round2(paidOf(o) + take), closes: take >= owed });
    left = round2(left - take);
  }
  return out;
}

// Order updates that take a payment back. `orders` is the current list.
export function undoPayment(applied, orders) {
  return (applied || []).flatMap(a => {
    const o = orders.find(x => x._id === a.id);
    if (!o) return [];
    return [{ id: a.id, paidAmount: Math.max(0, round2(paidOf(o) - a.amount)), status: 'entregado' }];
  });
}

// ─── Inventory history ──────────────────────────────────────────────────────
// Movements that touched the general stock, newest first. Taps on +/− land as
// separate edits, so hand edits of the same flavors a few minutes apart merge.
const MERGE_MS = 10 * 60 * 1000;

export function historyEntries(movements) {
  const out = [];
  for (const m of movements) {
    if (!signsOf(m.type).general) continue;
    const last = out.at(-1);
    const keys = Object.keys(m.quantities || {}).sort().join();
    if (m.type === 'manual' && last?.type === 'manual' && last.keys === keys
      && new Date(last.oldest) - new Date(m.date) < MERGE_MS) {
      for (const [k, v] of Object.entries(m.quantities)) last.quantities[k] = (last.quantities[k] || 0) + v;
      last.oldest = m.date;
      continue;
    }
    out.push({ ...m, quantities: { ...m.quantities }, keys, oldest: m.date });
  }
  return out;
}
