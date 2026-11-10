import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchNeeds, recipeBatch, formatAmount, recipeWeight, recipeStatus, usableOf, SEED_RECIPES, SEED_INGREDIENTS } from './recipes.js';

const ingredients = [
  { id: 'pina', name: 'Piña', unit: 'g', usable: 50 },
  { id: 'fresa', name: 'Fresa', unit: 'g', usable: 90 },
  { id: 'agua', name: 'Agua', unit: 'ml', usable: 100 },
];
const recipes = [
  { _id: 'a', items: [{ ingredient: 'pina', amount: 50 }, { ingredient: 'fresa', amount: 20 }] },
  { _id: 'b', items: [{ ingredient: 'pina', amount: 10 }, { ingredient: 'agua', amount: 4 }] },
];

test('batchNeeds multiplies by units and adds up shared ingredients', () => {
  const rows = batchNeeds(recipes, { a: 30, b: 10 }, ingredients);
  const pina = rows.find(r => r.id === 'pina');
  assert.equal(pina.use, 50 * 30 + 10 * 10);
  assert.equal(pina.buy, 1600 * 2);
  assert.equal(rows.find(r => r.id === 'agua').unit, 'ml');
});

test('batchNeeds buys more than it uses, by the usable percent', () => {
  const [fresa] = batchNeeds(recipes, { a: 9 }, ingredients).filter(r => r.id === 'fresa');
  assert.equal(fresa.use, 180);
  assert.equal(fresa.buy, 200);
});

test('batchNeeds skips recipes with no units and sorts by purchase', () => {
  const rows = batchNeeds(recipes, { a: 0, b: '3' }, ingredients);
  assert.deepEqual(rows.map(r => r.id), ['pina', 'agua']);
});

test('an unknown ingredient counts as fully usable', () => {
  const rows = batchNeeds([{ _id: 'x', items: [{ ingredient: 'kiwi', amount: 10 }] }], { x: 2 }, []);
  assert.deepEqual(rows[0], { id: 'kiwi', name: 'kiwi', unit: 'g', usable: 100, use: 20, buy: 20 });
});

test('recipeBatch gives each ingredient for n units, clean, in recipe order', () => {
  const rows = recipeBatch(recipes[1], 100, ingredients);
  assert.deepEqual(rows, [
    { id: 'pina', name: 'Piña', unit: 'g', per: 10, total: 1000 },
    { id: 'agua', name: 'Agua', unit: 'ml', per: 4, total: 400 },
  ]);
  assert.equal(recipeBatch({ items: [{ ingredient: 'kiwi', amount: 0 }] }, 5, []).length, 0);
});

test('usableOf falls back to 100 for missing or invalid values', () => {
  assert.equal(usableOf({ usable: 0 }), 100);
  assert.equal(usableOf({ usable: 140 }), 100);
  assert.equal(usableOf({}), 100);
  assert.equal(usableOf({ usable: 65 }), 65);
});

test('formatAmount switches to kg or L past 1000', () => {
  assert.equal(formatAmount(850), '850 g');
  assert.equal(formatAmount(1250), '1,25 kg');
  assert.equal(formatAmount(40, 'ml'), '40 ml');
  assert.equal(formatAmount(2000, 'ml'), '2 L');
});

test('seed recipes only use seed ingredients and weigh what was written down', () => {
  const ids = new Set(SEED_INGREDIENTS.map(i => i.id));
  for (const r of SEED_RECIPES) for (const i of r.items) assert.ok(ids.has(i.ingredient), `${r.id}: ${i.ingredient}`);
  const weight = Object.fromEntries(SEED_RECIPES.map(r => [r.id, recipeWeight(r)]));
  assert.deepEqual(weight, {
    antioxidante: 120, verde: 121, boost: 120, 'verde-v2': 120, 'berry-blast': 120, tropical: 120, kids: 60, bowl: 170,
  });
});

test('recipe status falls back to the old on/off switch', () => {
  assert.equal(recipeStatus({ status: 'historica', active: true }), 'historica');
  assert.equal(recipeStatus({ active: true }), 'activa');
  assert.equal(recipeStatus({}), 'proxima');
  const inUse = SEED_RECIPES.filter(r => recipeStatus(r) === 'activa').map(r => r.id);
  assert.deepEqual(inUse, ['antioxidante', 'boost', 'verde-v2']);
  assert.equal(recipeStatus(SEED_RECIPES.find(r => r.id === 'verde')), 'historica');
});
