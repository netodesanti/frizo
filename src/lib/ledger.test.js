import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paidOf, owedOf, summarize, allocatePayment, undoPayment, countResult, movementDelta, historyEntries,
} from './ledger.js';

const sale = (id, date, total, extra = {}) => ({
  _id: id, date, totalPrice: total, totalBags: total / 1200, status: 'entregado', locationId: 'f1', ...extra,
});

test('paid and owed amounts', () => {
  assert.equal(paidOf(sale('a', '1', 2400)), 0);
  assert.equal(owedOf(sale('a', '1', 2400)), 2400);
  assert.equal(paidOf(sale('a', '1', 2400, { paidAmount: 1000 })), 1000);
  assert.equal(owedOf(sale('a', '1', 2400, { paidAmount: 1000 })), 1400);
  assert.equal(owedOf(sale('a', '1', 2400, { status: 'pagado' })), 0);
  assert.equal(owedOf(sale('a', '1', 2400, { status: 'cancelado', paidAmount: 500 })), 0);
  // Overpaid data never shows more paid than the sale is worth.
  assert.equal(paidOf(sale('a', '1', 2400, { paidAmount: 9999 })), 2400);
});

test('summary counts partial payments as collected', () => {
  const s = summarize([
    sale('a', '1', 2400, { paidAmount: 1000 }),
    sale('b', '2', 1200, { status: 'pagado' }),
    sale('c', '3', 3600, { status: 'cancelado' }),
    { _id: 'd', date: '4', totalPrice: 1600, totalBags: 1, status: 'pendiente' },
  ], [{ amount: 500 }]);
  assert.equal(s.paid, 2200);
  assert.equal(s.pending, 1400 + 1600);
  assert.equal(s.profit, 1700);
  assert.equal(s.count, 3);
});

test('a full payment settles every sale', () => {
  const sales = [sale('a', '2026-11-01', 2400), sale('b', '2026-11-03', 1200)];
  const applied = allocatePayment(sales, 3600);
  assert.deepEqual(applied, [
    { id: 'a', amount: 2400, paidAmount: 2400, closes: true },
    { id: 'b', amount: 1200, paidAmount: 1200, closes: true },
  ]);
});

test('a partial payment settles the oldest sales first', () => {
  const sales = [sale('new', '2026-11-03', 1200), sale('old', '2026-11-01', 2400)];
  assert.deepEqual(allocatePayment(sales, 3000), [
    { id: 'old', amount: 2400, paidAmount: 2400, closes: true },
    { id: 'new', amount: 600, paidAmount: 600, closes: false },
  ]);
});

test('a second partial payment continues where the first stopped', () => {
  const sales = [sale('a', '2026-11-01', 2400, { paidAmount: 1000 }), sale('b', '2026-11-02', 1200)];
  assert.deepEqual(allocatePayment(sales, 2000), [
    { id: 'a', amount: 1400, paidAmount: 2400, closes: true },
    { id: 'b', amount: 600, paidAmount: 600, closes: false },
  ]);
});

test('paid and cancelled sales are skipped; extra money is not applied', () => {
  const sales = [
    sale('paid', '2026-11-01', 2400, { status: 'pagado' }),
    sale('cancelled', '2026-11-02', 2400, { status: 'cancelado' }),
    sale('open', '2026-11-03', 1200),
  ];
  assert.deepEqual(allocatePayment(sales, 5000), [{ id: 'open', amount: 1200, paidAmount: 1200, closes: true }]);
  assert.deepEqual(allocatePayment([], 1000), []);
  assert.deepEqual(allocatePayment(sales, 0), []);
});

test('undoing a payment puts the money back as owed', () => {
  const before = [sale('a', '2026-11-01', 2400), sale('b', '2026-11-02', 1200)];
  const applied = allocatePayment(before, 3000);
  // State after the payment landed.
  const after = before.map(o => {
    const a = applied.find(x => x.id === o._id);
    return a.closes ? { ...o, status: 'pagado', paidAmount: a.paidAmount } : { ...o, paidAmount: a.paidAmount };
  });
  const undo = undoPayment(applied, after);
  assert.deepEqual(undo, [
    { id: 'a', paidAmount: 0, status: 'entregado' },
    { id: 'b', paidAmount: 0, status: 'entregado' },
  ]);
  // A sale deleted since then is ignored.
  assert.deepEqual(undoPayment(applied, after.slice(0, 1)), [{ id: 'a', paidAmount: 0, status: 'entregado' }]);
});

test('counting a freezer: missing bags are sold, extra bags are a surplus', () => {
  assert.deepEqual(countResult({ verde: 10, boost: 4, antioxidante: 2 }, { verde: 7, boost: 4, antioxidante: 5 }), {
    sold: { verde: 3 }, surplus: { antioxidante: 3 },
  });
  assert.deepEqual(countResult(undefined, { verde: 0 }), { sold: {}, surplus: {} });
});

test('movements move bags between general stock and the freezer', () => {
  const q = { verde: 5, boost: 2 };
  assert.deepEqual(movementDelta({ type: 'restock', locationId: 'f1', quantities: q }), {
    general: { verde: -5, boost: -2 }, location: { verde: 5, boost: 2 },
  });
  assert.deepEqual(movementDelta({ type: 'return', locationId: 'f1', quantities: q }), {
    general: { verde: 5, boost: 2 }, location: { verde: -5, boost: -2 },
  });
  assert.deepEqual(movementDelta({ type: 'loss', locationId: 'f1', quantities: q }), {
    general: {}, location: { verde: -5, boost: -2 },
  });
  assert.deepEqual(movementDelta({ type: 'manual', quantities: { verde: -3 } }), {
    general: { verde: -3 }, location: {},
  });
  assert.deepEqual(movementDelta({ type: 'payment', locationId: 'f1', quantities: {} }), { general: {}, location: {} });
  // Undo is the exact opposite.
  assert.deepEqual(movementDelta({ type: 'restock', locationId: 'f1', quantities: q }, -1), {
    general: { verde: 5, boost: 2 }, location: { verde: -5, boost: -2 },
  });
});

test('inventory history merges quick taps and skips freezer-only changes', () => {
  const at = (min) => new Date(Date.UTC(2026, 10, 2, 12, min)).toISOString();
  const entries = historyEntries([ // newest first, as Firestore returns them
    { _id: '6', type: 'manual', quantities: { verde: 1 }, after: { verde: 42 }, date: at(40) },
    { _id: '5', type: 'loss', locationId: 'f1', quantities: { verde: 1 }, date: at(35) },
    { _id: '4', type: 'restock', locationId: 'f1', quantities: { verde: 10 }, date: at(30) },
    { _id: '3', type: 'manual', quantities: { verde: 1 }, after: { verde: 41 }, date: at(2) },
    { _id: '2', type: 'manual', quantities: { verde: 1 }, after: { verde: 40 }, date: at(1) },
    { _id: '1', type: 'manual', quantities: { verde: 1 }, after: { verde: 39 }, date: at(0) },
  ]);
  assert.deepEqual(entries.map(e => [e._id, e.quantities, e.after]), [
    ['6', { verde: 1 }, { verde: 42 }],
    ['4', { verde: 10 }, undefined],
    ['3', { verde: 3 }, { verde: 41 }],
  ]);
});
