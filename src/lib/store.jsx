import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  BASE_FLAVORS, DEFAULT_PRICE, addQty, cleanQty, consumed, newId, sumQty, movementDelta, countResult, allocatePayment, undoPayment,
} from '@/lib/data';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const withId = (snap) => snap.docs.map(d => ({ ...d.data(), _id: d.id }));
const stockRef = doc(db, 'config', 'stock');

// Writes land in the local cache right away and sync in the background, so the
// UI never waits on the network; only a rejected write (e.g. permissions) is shown.
const save = (promise) => {
  promise.catch(err => window.alert(`No se pudo guardar: ${err.message}`));
};

// Stock changes are applied as increments so two phones editing at once don't
// overwrite each other.
const bumpStock = (delta, batch) => {
  const data = Object.fromEntries(Object.entries(delta).filter(([, v]) => v).map(([k, v]) => [k, increment(v)]));
  if (Object.keys(data).length) batch.set(stockRef, data, { merge: true });
};

// Same for the bags held at a point of sale.
const bumpLocation = (id, delta, batch) => {
  const data = Object.fromEntries(Object.entries(delta).filter(([, v]) => v).map(([k, v]) => [k, increment(v)]));
  if (Object.keys(data).length) batch.set(doc(db, 'locations', id), { stock: data }, { merge: true });
};

// An order takes its bags from its point of sale, or from the general stock.
const bumpFor = (order, delta, batch) => (order.locationId
  ? bumpLocation(order.locationId, delta, batch)
  : bumpStock(delta, batch));

// Moves bags between the general stock and a point of sale (sign -1 undoes it).
const applyMovement = (m, sign, batch) => {
  const d = movementDelta(m, sign);
  bumpStock(d.general, batch);
  if (m.locationId) bumpLocation(m.locationId, d.location, batch);
};

// `after` is how many bags of each edited flavor were left once the edit landed.
const logEdit = (batch, quantities, after) => {
  const q = cleanQty(quantities);
  if (!Object.keys(q).length) return;
  const left = Object.fromEntries(Object.keys(q).map(k => [k, after[k] || 0]));
  batch.set(doc(collection(db, 'movements')), { type: 'manual', quantities: q, after: left, date: new Date().toISOString() });
};

export function StoreProvider({ children }) {
  const [stock, setStock] = useState({});
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState([]);
  const [allCosts, setAllCosts] = useState([]);
  const [allTransfers, setAllTransfers] = useState([]);
  const [products, setProducts] = useState(null);
  const [partners, setPartners] = useState([]);
  const [settings, setSettings] = useState({});
  const [archives, setArchives] = useState([]);
  const [locations, setLocations] = useState([]);
  const [allMovements, setAllMovements] = useState([]);

  useEffect(() => {
    const subs = [
      onSnapshot(stockRef, s => { if (s.exists()) setStock(s.data()); setLoading(false); }),
      onSnapshot(query(collection(db, 'orders'), orderBy('date', 'desc')), s => setAllOrders(withId(s))),
      onSnapshot(query(collection(db, 'costs'), orderBy('date', 'desc')), s => setAllCosts(withId(s))),
      onSnapshot(query(collection(db, 'transfers'), orderBy('date', 'desc')), s => setAllTransfers(withId(s))),
      onSnapshot(query(collection(db, 'products'), orderBy('order')), s => setProducts(s.docs.map(d => ({ ...d.data(), id: d.id })))),
      onSnapshot(doc(db, 'config', 'partners'), s => setPartners(s.exists() ? s.data().list || [] : [])),
      onSnapshot(doc(db, 'config', 'settings'), s => setSettings(s.exists() ? s.data() : {})),
      onSnapshot(doc(db, 'config', 'archives'), s => setArchives(s.exists() ? s.data().list || [] : [])),
      onSnapshot(query(collection(db, 'locations'), orderBy('createdAt')), s => setLocations(withId(s))),
      onSnapshot(query(collection(db, 'movements'), orderBy('date', 'desc')), s => setAllMovements(withId(s))),
    ];
    return () => subs.forEach(unsub => unsub());
  }, []);

  // Seed the products collection with the original flavors the first time.
  useEffect(() => {
    if (!products || products.length) return;
    const batch = writeBatch(db);
    BASE_FLAVORS.forEach((f, i) => batch.set(doc(db, 'products', f.id), {
      name: f.name, emoji: f.emoji, color: f.color, order: i, active: true,
      price: DEFAULT_PRICE, description: '', ingredients: [], image: '', imagePath: '',
    }));
    batch.commit();
  }, [products]);

  const value = useMemo(() => {
    // Records tagged with an archive id belong to a closed period (Ajustes → Historial).
    const live = (list) => list.filter(d => !d.archive);
    const orders = live(allOrders);
    const costs = live(allCosts);
    const transfers = live(allTransfers);
    const movements = live(allMovements);

    const placeOrder = (order) => {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'orders')), order);
      bumpFor(order, addQty({}, consumed(order), -1), batch);
      save(batch.commit());
    };

    const placeOrders = (list) => {
      const batch = writeBatch(db);
      let delta = {};
      for (const order of list) {
        batch.set(doc(collection(db, 'orders')), order);
        delta = addQty(delta, consumed(order), -1);
      }
      bumpStock(delta, batch);
      save(batch.commit());
    };

    const editOrder = (id, updates) => {
      const prev = allOrders.find(o => o._id === id);
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', id), updates);
      if (prev) bumpFor(prev, addQty(consumed(prev), consumed({ ...prev, ...updates }), -1), batch);
      save(batch.commit());
    };

    const deleteOrder = (id) => {
      const prev = allOrders.find(o => o._id === id);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'orders', id));
      if (prev) bumpFor(prev, consumed(prev), batch);
      save(batch.commit());
    };

    // A lump payment from a point of sale, full or partial. It settles the
    // oldest sales first and is logged so it can be undone.
    const payLocation = (loc, amount) => {
      const sales = orders.filter(o => o.locationId === loc._id);
      const applied = allocatePayment(sales, amount);
      if (!applied.length) return;
      const date = new Date().toISOString();
      const batch = writeBatch(db);
      for (const a of applied) {
        batch.update(doc(db, 'orders', a.id), a.closes
          ? { status: 'pagado', paidAmount: a.paidAmount, paidAt: date }
          : { paidAmount: a.paidAmount });
      }
      batch.set(doc(collection(db, 'movements')), {
        type: 'payment', locationId: loc._id, amount: applied.reduce((s, a) => s + a.amount, 0), quantities: {},
        applied: applied.map(({ id, amount: amt }) => ({ id, amount: amt })), date,
      });
      save(batch.commit());
    };

    const addMovement = (m) => {
      const batch = writeBatch(db);
      const entry = { ...m, quantities: cleanQty(m.quantities), date: new Date().toISOString() };
      batch.set(doc(collection(db, 'movements')), entry);
      applyMovement(entry, 1, batch);
      save(batch.commit());
    };

    const deleteMovement = (id) => {
      const prev = allMovements.find(m => m._id === id);
      if (!prev) return;
      const batch = writeBatch(db);
      batch.delete(doc(db, 'movements', id));
      applyMovement(prev, -1, batch);
      for (const u of undoPayment(prev.applied, allOrders)) {
        batch.update(doc(db, 'orders', u.id), { paidAmount: u.paidAmount, status: u.status });
      }
      save(batch.commit());
    };

    // A count of what's left at a point of sale: whatever is missing was sold,
    // and any surplus is recorded as an adjustment.
    const countLocation = (loc, counted) => {
      const { sold, surplus } = countResult(loc.stock, counted);
      const date = new Date().toISOString();
      const batch = writeBatch(db);
      const totalBags = sumQty(sold);
      if (totalBags) {
        const pricePerBag = loc.price || 0;
        const order = {
          id: newId(), customer: loc.name, location: '', lat: null, lng: null, notes: 'Conteo',
          quantities: sold, totalBags, pricePerBag, totalPrice: totalBags * pricePerBag,
          status: 'entregado', date, locationId: loc._id, source: 'count',
        };
        batch.set(doc(collection(db, 'orders')), order);
        bumpFor(order, addQty({}, sold, -1), batch);
      }
      if (sumQty(surplus)) {
        const m = { type: 'adjust', locationId: loc._id, quantities: surplus, date };
        batch.set(doc(collection(db, 'movements')), m);
        applyMovement(m, 1, batch);
      }
      save(batch.commit());
      return totalBags;
    };

    const closePeriod = (label) => {
      const id = newId();
      const dates = [...orders, ...costs, ...transfers, ...movements].map(d => d.date).filter(Boolean).sort();
      const refs = [
        ...orders.map(o => doc(db, 'orders', o._id)),
        ...costs.map(c => doc(db, 'costs', c._id)),
        ...transfers.map(t => doc(db, 'transfers', t._id)),
        ...movements.map(m => doc(db, 'movements', m._id)),
      ];
      const entry = { id, label, startedAt: dates[0] || null, closedAt: new Date().toISOString() };
      save(setDoc(doc(db, 'config', 'archives'), { list: [...archives, entry] }));
      for (let i = 0; i < refs.length; i += 450) {
        const batch = writeBatch(db);
        refs.slice(i, i + 450).forEach(r => batch.update(r, { archive: id }));
        save(batch.commit());
      }
    };

    return {
      loading, stock, products, partners, settings, archives, locations, movements, allMovements,
      flavors: products?.length ? products : BASE_FLAVORS,
      orders, costs, transfers, allOrders, allCosts, allTransfers,
      placeOrder, placeOrders, editOrder, deleteOrder, closePeriod, payLocation,
      addMovement, deleteMovement, countLocation,
      // Edits made by hand are logged so the inventory has a history.
      setStockCount: (id, n) => {
        const batch = writeBatch(db);
        batch.set(stockRef, { [id]: n }, { merge: true });
        logEdit(batch, { [id]: n - (stock[id] || 0) }, { [id]: n });
        save(batch.commit());
      },
      bumpStockCount: (id, d) => {
        const batch = writeBatch(db);
        batch.set(stockRef, { [id]: increment(d) }, { merge: true });
        logEdit(batch, { [id]: d }, { [id]: (stock[id] || 0) + d });
        save(batch.commit());
      },
      replaceStock: (next) => {
        const batch = writeBatch(db);
        batch.set(stockRef, next);
        logEdit(batch, addQty(next, stock, -1), next);
        save(batch.commit());
      },
      addLocation: (l) => save(addDoc(collection(db, 'locations'), { stock: {}, ...l, createdAt: new Date().toISOString() })),
      editLocation: (id, u) => save(updateDoc(doc(db, 'locations', id), u)),
      deleteLocation: (id) => save(deleteDoc(doc(db, 'locations', id))),
      addCost: (c) => save(addDoc(collection(db, 'costs'), c)),
      editCost: (id, u) => save(updateDoc(doc(db, 'costs', id), u)),
      deleteCost: (id) => save(deleteDoc(doc(db, 'costs', id))),
      addTransfer: (t) => save(addDoc(collection(db, 'transfers'), t)),
      editTransfer: (id, u) => save(updateDoc(doc(db, 'transfers', id), u)),
      deleteTransfer: (id) => save(deleteDoc(doc(db, 'transfers', id))),
      savePartners: (list) => save(setDoc(doc(db, 'config', 'partners'), { list })),
      saveSettings: (data) => save(setDoc(doc(db, 'config', 'settings'), data, { merge: true })),
    };
  }, [loading, stock, products, partners, settings, archives, locations, allOrders, allCosts, allTransfers, allMovements]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
