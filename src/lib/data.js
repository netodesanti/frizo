import { Apple, Package, Car, Megaphone, Wrench, Tag } from 'lucide-react';
import { auth } from '@/firebase';

// Fallback until the `products` collection loads (and for the fixed Excel columns).
export const BASE_FLAVORS = [
  { id: 'verde',        name: 'Batido Verde',  emoji: '🥬', color: '#5cb85c' },
  { id: 'antioxidante', name: 'Antioxidante',  emoji: '🫐', color: '#e84393' },
  { id: 'boost',        name: 'Boost Inmune',  emoji: '🧡', color: '#f39c12' },
];

export const DEFAULT_PRICE = 1600;

export const STATUSES = [
  { id: 'pendiente',  label: 'Pendiente' },
  { id: 'preparando', label: 'Preparando' },
  { id: 'entregado',  label: 'Entregado' },
  { id: 'pagado',     label: 'Pagado' },
  { id: 'cancelado',  label: 'Cancelado' },
];
export const statusOf = (id) => STATUSES.find(s => s.id === (id || 'pendiente')) || STATUSES[0];
export const NEXT_STATUS = { pendiente: 'preparando', preparando: 'entregado', entregado: 'pagado' };

export const COST_CATEGORIES = [
  { id: 'ingredientes', label: 'Ingredientes', icon: Apple,     tone: 'mint' },
  { id: 'empaque',      label: 'Empaque',      icon: Package,   tone: 'peach' },
  { id: 'transporte',   label: 'Transporte',   icon: Car,       tone: 'sky' },
  { id: 'marketing',    label: 'Marketing',    icon: Megaphone, tone: 'blush' },
  { id: 'equipo',       label: 'Equipo',       icon: Wrench,    tone: 'gray' },
  { id: 'otros',        label: 'Otros',        icon: Tag,       tone: 'lilac' },
];
export const categoryOf = (id) => COST_CATEGORIES.find(c => c.id === id) || COST_CATEGORIES[5];

export const COMPANY = { id: 'empresa', name: 'Empresa' };

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const sumBy = (list, fn) => list.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
export const sumQty = (q) => Object.values(q || {}).reduce((s, v) => s + (Number(v) || 0), 0);
// Returns a + sign * b for every key in either quantity map.
export const addQty = (a, b, sign = 1) => {
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = (out[k] || 0) + sign * (b[k] || 0);
  return out;
};

// Bags an order takes out of stock. Cancelled orders give theirs back.
export const consumed = (o) => (o.status === 'cancelado' ? {} : o.quantities || {});
export const orderTotal = (o) => o.totalPrice || (o.totalBags || 0) * DEFAULT_PRICE;
export const flavorOf = (flavors, id) => flavors.find(f => f.id === id) || { id, name: id, emoji: '🥤', color: '#8e8e93' };

export function summarize(orders, costs) {
  const live = orders.filter(o => o.status !== 'cancelado');
  const paid = sumBy(live.filter(o => o.status === 'pagado'), orderTotal);
  const spent = sumBy(costs, c => c.amount);
  return {
    count: live.length,
    bags: sumBy(live, o => o.totalBags),
    paid,
    pending: sumBy(live.filter(o => o.status !== 'pagado'), orderTotal),
    spent,
    profit: paid - spent,
  };
}

// Positive: the company owes that partner. Negative: the partner holds company money.
// An expense paid by a partner counts as money they put in; a transfer moves it
// from one side to the other (the company itself is not tracked).
export function partnerBalances(partners, costs, transfers) {
  const bal = Object.fromEntries(partners.map(p => [p.id, 0]));
  for (const c of costs) if (c.paidBy in bal) bal[c.paidBy] += c.amount || 0;
  for (const t of transfers) {
    if (t.from in bal) bal[t.from] += t.amount || 0;
    if (t.to in bal) bal[t.to] -= t.amount || 0;
  }
  return bal;
}

// What makes up one partner's balance.
export function partnerFlows(id, costs, transfers) {
  return {
    paidCosts: sumBy(costs.filter(c => c.paidBy === id), c => c.amount),
    sent: sumBy(transfers.filter(t => t.from === id), t => t.amount),
    received: sumBy(transfers.filter(t => t.to === id), t => t.amount),
  };
}

// Payments between partners that leave everyone having put in the same amount.
export function settleUp(partners, balances) {
  const avg = partners.reduce((s, p) => s + balances[p.id], 0) / partners.length;
  const diffs = partners.map(p => ({ p, d: balances[p.id] - avg }));
  const owed = diffs.filter(x => x.d > 0.005).sort((a, b) => b.d - a.d);
  const owing = diffs.filter(x => x.d < -0.005).sort((a, b) => a.d - b.d);
  const out = [];
  for (let i = 0, j = 0; i < owing.length && j < owed.length;) {
    const amount = Math.min(-owing[i].d, owed[j].d);
    out.push({ from: owing[i].p, to: owed[j].p, amount });
    owing[i].d += amount; owed[j].d -= amount;
    if (owing[i].d > -0.005) i++;
    if (owed[j].d < 0.005) j++;
  }
  return out;
}

export const myPartnerId = (partners) => {
  const email = auth.currentUser?.email?.toLowerCase();
  return partners.find(p => email && p.email?.toLowerCase() === email)?.id;
};

export const mapsUrl = (o) => o.lat && o.lng
  ? `https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.location)}`;
