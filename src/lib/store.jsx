import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, writeBatch, increment,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { BASE_FLAVORS, DEFAULT_PRICE, addQty, consumed, newId } from '@/lib/data';

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

    const placeOrder = (order) => {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'orders')), order);
      bumpStock(addQty({}, consumed(order), -1), batch);
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
      if (prev) bumpStock(addQty(consumed(prev), consumed({ ...prev, ...updates }), -1), batch);
      save(batch.commit());
    };

    const deleteOrder = (id) => {
      const prev = allOrders.find(o => o._id === id);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'orders', id));
      if (prev) bumpStock(consumed(prev), batch);
      save(batch.commit());
    };

    const closePeriod = (label) => {
      const id = newId();
      const dates = [...orders, ...costs, ...transfers].map(d => d.date).filter(Boolean).sort();
      const refs = [
        ...orders.map(o => doc(db, 'orders', o._id)),
        ...costs.map(c => doc(db, 'costs', c._id)),
        ...transfers.map(t => doc(db, 'transfers', t._id)),
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
      loading, stock, products, partners, settings, archives,
      flavors: products?.length ? products : BASE_FLAVORS,
      orders, costs, transfers, allOrders, allCosts, allTransfers,
      placeOrder, placeOrders, editOrder, deleteOrder, closePeriod,
      setStockCount: (id, n) => save(setDoc(stockRef, { [id]: n }, { merge: true })),
      bumpStockCount: (id, d) => save(setDoc(stockRef, { [id]: increment(d) }, { merge: true })),
      replaceStock: (next) => save(setDoc(stockRef, next)),
      addCost: (c) => save(addDoc(collection(db, 'costs'), c)),
      editCost: (id, u) => save(updateDoc(doc(db, 'costs', id), u)),
      deleteCost: (id) => save(deleteDoc(doc(db, 'costs', id))),
      addTransfer: (t) => save(addDoc(collection(db, 'transfers'), t)),
      editTransfer: (id, u) => save(updateDoc(doc(db, 'transfers', id), u)),
      deleteTransfer: (id) => save(deleteDoc(doc(db, 'transfers', id))),
      savePartners: (list) => save(setDoc(doc(db, 'config', 'partners'), { list })),
      saveSettings: (data) => save(setDoc(doc(db, 'config', 'settings'), data, { merge: true })),
    };
  }, [loading, stock, products, partners, settings, archives, allOrders, allCosts, allTransfers]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
