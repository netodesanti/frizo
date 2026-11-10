// Recipe and batch math, kept free of Firebase and React so it can be tested
// with `npm test`. Imports here must stay relative (no "@/").
//
// A recipe makes one unit (a bag, a boli, a bowl) and lists grams (or ml) of
// each ingredient. Each ingredient has `usable`: the percent of what you buy
// that ends up in the product once peels, cores, stems and seeds are gone.

export const UNITS = [
  { id: 'bolsa', one: 'bolsa', many: 'bolsas' },
  { id: 'boli', one: 'boli', many: 'bolis' },
  { id: 'bowl', one: 'bowl', many: 'bowls' },
];
export const unitOf = (id) => UNITS.find(u => u.id === id) || UNITS[0];
export const countOf = (n, unitId) => `${n} ${n === 1 ? unitOf(unitId).one : unitOf(unitId).many}`;

// Where a recipe stands: in use now, coming soon, or kept only for the record.
export const RECIPE_STATUSES = [
  { id: 'activa', label: 'En uso' },
  { id: 'proxima', label: 'Próximamente' },
  { id: 'historica', label: 'Histórica' },
];
export const recipeStatus = (r) => r.status || (r.active ? 'activa' : 'proxima');

export const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const recipeWeight = (r) => (r.items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);

// What a batch needs, one row per ingredient, biggest purchase first.
// `counts` maps recipe id → how many units are being made.
// `use` is what goes into the product; `buy` adds what gets thrown away.
export function batchNeeds(recipes, counts, ingredients) {
  const rows = new Map();
  for (const r of recipes) {
    const n = Number(counts[r._id ?? r.id]) || 0;
    if (n <= 0) continue;
    for (const item of r.items || []) {
      const amount = (Number(item.amount) || 0) * n;
      if (!amount) continue;
      const ing = ingredients.find(i => i.id === item.ingredient) || { id: item.ingredient, name: item.ingredient, unit: 'g', usable: 100 };
      const row = rows.get(ing.id) || { id: ing.id, name: ing.name, unit: ing.unit || 'g', usable: usableOf(ing), use: 0 };
      row.use += amount;
      rows.set(ing.id, row);
    }
  }
  return [...rows.values()]
    .map(r => ({ ...r, buy: r.use * 100 / r.usable }))
    .sort((a, b) => b.buy - a.buy);
}

// What goes into `n` units of one recipe, clean (already peeled), in the
// order the recipe lists them. `per` is the amount for one unit.
export function recipeBatch(recipe, n, ingredients) {
  const units = Number(n) || 0;
  return (recipe.items || [])
    .filter(item => Number(item.amount) > 0)
    .map(item => {
      const ing = ingredients.find(i => i.id === item.ingredient);
      const per = Number(item.amount);
      return { id: item.ingredient, name: ing?.name || item.ingredient, unit: ing?.unit || 'g', per, total: per * units };
    });
}

// Anything outside 1–100 is treated as "all of it is usable".
export const usableOf = (ing) => {
  const u = Number(ing?.usable);
  return u > 0 && u <= 100 ? u : 100;
};

// 850 g, 1.25 kg, 40 ml, 2 L.
export function formatAmount(n, unit = 'g') {
  const big = unit === 'ml' ? 'L' : 'kg';
  if (n >= 1000) return `${(n / 1000).toLocaleString('es', { maximumFractionDigits: n >= 10000 ? 1 : 2 })} ${big}`;
  return `${Math.round(n).toLocaleString('es')} ${unit}`;
}

// ─── Starting data ──────────────────────────────────────────────────────────
// Loaded once, the first time the app finds no ingredient list. Usable
// percentages are typical kitchen yields, meant to be adjusted after weighing.
export const SEED_INGREDIENTS = [
  { id: 'pina',        name: 'Piña',        unit: 'g',  usable: 50 },
  { id: 'fresa',       name: 'Fresa',       unit: 'g',  usable: 90 },
  { id: 'banano',      name: 'Banano',      unit: 'g',  usable: 65 },
  { id: 'papaya',      name: 'Papaya',      unit: 'g',  usable: 65 },
  { id: 'naranja',     name: 'Naranja',     unit: 'g',  usable: 70 },
  { id: 'mango',       name: 'Mango',       unit: 'g',  usable: 65 },
  { id: 'arandano',    name: 'Arándano',    unit: 'g',  usable: 100 },
  { id: 'mora',        name: 'Mora',        unit: 'g',  usable: 100 },
  { id: 'pepino',      name: 'Pepino',      unit: 'g',  usable: 90 },
  { id: 'kale',        name: 'Kale',        unit: 'g',  usable: 70 },
  { id: 'espinaca',    name: 'Espinaca',    unit: 'g',  usable: 90 },
  { id: 'acelga',      name: 'Acelga',      unit: 'g',  usable: 80 },
  { id: 'hierbabuena', name: 'Hierbabuena', unit: 'g',  usable: 60 },
  { id: 'perejil',     name: 'Perejil',     unit: 'g',  usable: 70 },
  { id: 'chia',        name: 'Chía',        unit: 'g',  usable: 100 },
  { id: 'agua',        name: 'Agua',        unit: 'ml', usable: 100 },
];

const items = (obj) => Object.entries(obj).map(([ingredient, amount]) => ({ ingredient, amount }));

export const SEED_RECIPES = [
  { id: 'antioxidante', name: 'Antioxidante', emoji: '🫐', color: '#e84393', unit: 'bolsa', status: 'activa', note: 'Receta original',
    items: items({ fresa: 50, banano: 25, arandano: 15, papaya: 30 }) },
  { id: 'verde', name: 'Batido Verde', emoji: '🥬', color: '#5cb85c', unit: 'bolsa', status: 'historica', note: 'Receta original, reemplazada por la V2',
    items: items({ pina: 50, pepino: 30, kale: 25, espinaca: 10, acelga: 3, hierbabuena: 2, perejil: 1 }) },
  { id: 'boost', name: 'Boost Inmune', emoji: '🧡', color: '#f39c12', unit: 'bolsa', status: 'activa', note: 'Receta original · bolsa naranja',
    items: items({ pina: 40, naranja: 28, fresa: 25, papaya: 25, hierbabuena: 2 }) },
  { id: 'verde-v2', name: 'Batido Verde V2', emoji: '🥬', color: '#5cb85c', unit: 'bolsa', status: 'activa', note: '',
    items: items({ pina: 52, pepino: 30, kale: 25, espinaca: 10, hierbabuena: 3 }) },
  { id: 'berry-blast', name: 'Berry Blast', emoji: '🫐', color: '#d6336c', unit: 'bolsa', status: 'proxima', note: '',
    items: items({ fresa: 50, banano: 40, mora: 15, naranja: 10, arandano: 5 }) },
  { id: 'tropical', name: 'Tropical Balanceado', emoji: '🍍', color: '#f5a623', unit: 'bolsa', status: 'proxima', note: '',
    items: items({ pina: 55, papaya: 40, naranja: 23, chia: 2 }) },
  { id: 'kids', name: 'Frizo Kids', emoji: '🍓', color: '#ff6b81', unit: 'boli', status: 'proxima', note: '',
    items: items({ fresa: 36, banano: 20, agua: 4 }) },
  { id: 'bowl', name: 'Frizo Bowl', emoji: '🥭', color: '#ff9f43', unit: 'bowl', status: 'proxima', note: '',
    items: items({ fresa: 80, banano: 45, mango: 45 }) },
];
