import { useState } from 'react';
import { Archive, Carrot, ChevronDown, Eraser, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  UNITS, RECIPE_STATUSES, batchNeeds, countOf, formatAmount, recipeStatus, recipeWeight, slugify, unitOf, usableOf,
} from '@/lib/recipes';
import {
  Screen, Section, Stack, Card, ListItem, TextField, Stepper, FlavorTile, Tag, IconButton, Button, Chips,
  EmptyState, Sheet, useSticky,
} from '@/components/kit';

const backToRecipes = { label: 'Recetas', onClick: () => goBack('products/recipes') };

// The batch being planned survives leaving the page (e.g. at the market).
const BATCH_KEY = 'frizo.batch';
const loadBatch = () => {
  try { return JSON.parse(localStorage.getItem(BATCH_KEY)) || {}; } catch { return {}; }
};
const storeBatch = (counts) => {
  try { localStorage.setItem(BATCH_KEY, JSON.stringify(counts)); } catch { /* private mode */ }
};

const uniqueId = (name, taken) => {
  const base = slugify(name) || 'item';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
};

// ─── Recipes + batch calculator ─────────────────────────────────────────────
export function RecipesPage() {
  const { recipes, ingredients } = useStore();
  const [counts, setCounts] = useState(loadBatch);
  const [showOld, setShowOld] = useState(false);
  const setCount = (id, n) => setCounts(c => {
    const next = { ...c, [id]: Math.max(0, n) };
    if (!next[id]) delete next[id];
    storeBatch(next);
    return next;
  });
  const clear = () => { setCounts({}); storeBatch({}); };

  const byStatus = (st) => recipes.filter(r => recipeStatus(r) === st);
  const inUse = byStatus('activa');
  const later = byStatus('proxima');
  const old = byStatus('historica');
  // Historic recipes are kept for the record only; they don't go in a batch.
  const current = [...inUse, ...later];
  const needs = batchNeeds(current, counts, ingredients);
  const planned = current.filter(r => counts[r._id] > 0);
  const totalBuy = needs.filter(n => n.unit === 'g').reduce((s, n) => s + n.buy, 0);

  const row = (r) => (
    <Card key={r._id} className={cn('flex items-center gap-3 p-3 pr-3.5', counts[r._id] > 0 && 'ring-2 ring-brand-lime')}>
      <button type="button" onClick={() => navigate(`products/recipes/${r._id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <FlavorTile flavor={r} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{r.name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {formatAmount(recipeWeight(r))} por {unitOf(r.unit).one} · {r.items?.length || 0} ingredientes
          </span>
        </span>
      </button>
      <Stepper value={counts[r._id] || 0} label={`Cuántas de ${r.name}`} onChange={v => setCount(r._id, v)} />
    </Card>
  );

  return (
    <Screen title="Recetas" eyebrow="Cuánta fruta comprar" back={{ label: 'Productos', onClick: () => goBack('products') }}
      actions={<IconButton icon={Plus} label="Nueva receta" dark onClick={() => navigate('products/recipes/new')} />}>
      <p className="px-1 text-[14px] text-muted-foreground">
        Cada receta es para una unidad. Poné cuántas van a hacer y abajo sale cuánto comprar, contando cáscaras, corazones y tallos.
      </p>

      {inUse.length > 0 && <Section title="En uso"><Stack>{inUse.map(row)}</Stack></Section>}
      {later.length > 0 && <Section title="Próximamente"><Stack>{later.map(row)}</Stack></Section>}
      {old.length > 0 && (
        <Section>
          <button type="button" onClick={() => setShowOld(v => !v)}
            className="flex w-full items-center gap-2 px-1 text-left font-display text-[20px] font-bold tracking-tight">
            <span className="flex-1">Históricas <span className="text-muted-foreground">{old.length}</span></span>
            <ChevronDown className={cn('size-5 text-muted-foreground transition-transform', showOld && 'rotate-180')} />
          </button>
          {showOld && (
            <Stack>
              {old.map(r => (
                <ListItem key={r._id} leading={<FlavorTile flavor={r} size={44} />} title={r.name} chevron
                  subtitle={r.note || `${formatAmount(recipeWeight(r))} por ${unitOf(r.unit).one}`}
                  onClick={() => navigate(`products/recipes/${r._id}`)} className="opacity-75" />
              ))}
            </Stack>
          )}
        </Section>
      )}
      {recipes.length === 0 && <EmptyState emoji="📖" title="Sin recetas">Creá la primera con el botón +.</EmptyState>}

      <Section title="Lista de compras" action={planned.length > 0 && (
        <button type="button" onClick={clear} className="flex items-center gap-1 text-[14px] font-semibold text-primary">
          <Eraser className="size-4" /> Limpiar
        </button>
      )}>
        {needs.length === 0 ? (
          <Card className="px-5 py-6 text-center text-[14px] text-muted-foreground">
            Poné cuántas van a hacer de cada receta para ver qué comprar.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="grain bg-primary px-5 py-4 text-white">
              <div className="text-[13px] font-semibold text-white/60">
                Para {planned.map(r => `${countOf(counts[r._id], r.unit)} de ${r.name}`).join(' + ')}
              </div>
              <div className="font-display text-[34px] font-bold leading-tight text-brand-lime tabular-nums">{formatAmount(totalBuy)}</div>
              <div className="text-[13px] text-white/60">de fruta y verdura para comprar</div>
            </div>
            <div className="divide-y divide-border">
              {needs.map(n => (
                <div key={n.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-semibold">{n.name}</div>
                    <div className="text-[13px] text-muted-foreground">
                      Va {formatAmount(n.use, n.unit)} limpio{n.usable < 100 && ` · ${n.usable}% aprovechable`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-[19px] font-bold tabular-nums">{formatAmount(n.buy, n.unit)}</div>
                    <div className="text-[12px] text-muted-foreground">comprar</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </Section>

      <ListItem icon={Carrot} tone="peach" title="Ingredientes y desperdicio" subtitle="Cuánto de cada fruta se aprovecha"
        chevron onClick={() => navigate('products/ingredients')} />
    </Screen>
  );
}

// ─── One recipe ─────────────────────────────────────────────────────────────
export function RecipePage({ id }) {
  const { recipes } = useStore();
  const recipe = recipes.find(r => r._id === id);
  if (id !== 'new' && !recipe) return <Screen title="Receta" back={backToRecipes} />;
  return <RecipeEditor key={id} recipe={recipe} />;
}

const EMPTY_RECIPE = { name: '', emoji: '🥤', color: '#5cb85c', unit: 'bolsa', note: '' };

function RecipeEditor({ recipe }) {
  const { recipes, ingredients, saveRecipe, deleteRecipe, saveIngredients } = useStore();
  const nameOf = (iid) => ingredients.find(i => i.id === iid)?.name || iid;
  const [form, setForm] = useState(() => ({ ...EMPTY_RECIPE, ...recipe, status: recipe ? recipeStatus(recipe) : 'proxima' }));
  const [rows, setRows] = useState(() => (recipe?.items?.length
    ? recipe.items.map(i => ({ name: nameOf(i.ingredient), amount: String(i.amount) }))
    : [{ name: '', amount: '' }]));
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const weight = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    const filled = rows.filter(r => r.name.trim() && parseFloat(r.amount) > 0);
    if (!filled.length) { setError('Agregá al menos un ingrediente con cantidad'); return; }

    // Names typed that aren't in the ingredient list yet become new ingredients.
    const list = [...ingredients];
    const items = filled.map(r => {
      const name = r.name.trim();
      let ing = list.find(i => i.name.toLowerCase() === name.toLowerCase() || i.id === slugify(name));
      if (!ing) {
        ing = { id: uniqueId(name, list.map(i => i.id)), name, unit: 'g', usable: 100 };
        list.push(ing);
      }
      return { ingredient: ing.id, amount: parseFloat(r.amount) };
    });
    if (list.length !== ingredients.length) saveIngredients(list);

    const id = recipe?._id || uniqueId(form.name, recipes.map(r => r._id));
    const order = recipe ? recipe.order : Math.max(-1, ...recipes.map(r => r.order ?? 0)) + 1;
    saveRecipe(id, {
      name: form.name.trim(), emoji: form.emoji.trim(), color: form.color, unit: form.unit,
      status: form.status, note: form.note.trim(), items, order,
    });
    goBack('products/recipes');
  };

  const remove = () => {
    if (!window.confirm(`¿Eliminar la receta ${recipe.name}?`)) return;
    deleteRecipe(recipe._id);
    goBack('products/recipes');
  };

  return (
    <Screen title={recipe ? recipe.name : 'Nueva receta'} back={backToRecipes}>
      <form onSubmit={handleSave} className="space-y-5">
        <TextField label="Nombre" placeholder="Batido Verde" value={form.name} onChange={set('name')} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label="Emoji" value={form.emoji} onChange={set('emoji')} />
          <label className="block rounded-[20px] bg-card px-4 py-3 shadow-soft">
            <span className="block text-[12px] font-semibold text-muted-foreground">Color</span>
            <input type="color" value={form.color} onChange={set('color')}
              className="mt-0.5 h-7 w-full cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0" />
          </label>
        </div>

        <div className="space-y-2">
          <div className="px-1 text-[13px] font-semibold text-muted-foreground">La receta es para 1</div>
          <Chips value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} options={UNITS.map(u => ({ id: u.id, label: u.one }))} />
        </div>

        <Section title="Ingredientes" action={<Tag tone="lime">{formatAmount(weight)} en total</Tag>}>
          <datalist id="ingredient-names">
            {ingredients.map(i => <option key={i.id} value={i.name} />)}
          </datalist>
          <Stack>
            {rows.map((r, i) => (
              <Card key={i} className="flex items-center gap-2 py-2 pl-4 pr-2">
                <input list="ingredient-names" placeholder="Ingrediente" aria-label="Ingrediente" value={r.name}
                  onChange={e => setRow(i, 'name', e.target.value)}
                  className="h-10 min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/80" />
                <label className="flex h-10 shrink-0 items-center gap-1 rounded-2xl bg-muted px-3 focus-within:ring-2 focus-within:ring-brand-lime">
                  <input type="number" inputMode="decimal" min="0" step="any" placeholder="0" aria-label={`Cantidad de ${r.name || 'ingrediente'}`}
                    value={r.amount} onChange={e => setRow(i, 'amount', e.target.value)} onFocus={e => e.target.select()}
                    className="w-12 bg-transparent text-right font-display text-[18px] font-bold outline-none" />
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {ingredients.find(x => x.name.toLowerCase() === r.name.trim().toLowerCase())?.unit || 'g'}
                  </span>
                </label>
                <IconButton icon={X} label="Quitar" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="size-10 bg-transparent shadow-none" />
              </Card>
            ))}
            <button type="button" onClick={() => setRows(rs => [...rs, { name: '', amount: '' }])}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-input py-3.5 text-[15px] font-semibold text-muted-foreground transition-transform active:scale-[0.98]">
              <Plus className="size-5" /> Agregar ingrediente
            </button>
          </Stack>
        </Section>

        <div className="space-y-2">
          <div className="px-1 text-[13px] font-semibold text-muted-foreground">Estado</div>
          <Chips value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
            options={RECIPE_STATUSES.map(st => ({ id: st.id, label: st.label }))} />
          {form.status === 'historica' && (
            <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
              <Archive className="size-4" /> Se guarda como registro y no aparece en la calculadora.
            </p>
          )}
        </div>
        <TextField label="Nota (opcional)" multiline placeholder="Ej. bolsa naranja, licuar con agua" value={form.note} onChange={set('note')} />

        {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
        <Button type="submit">Guardar receta</Button>
        {recipe && <Button type="button" variant="danger" onClick={remove}><Trash2 /> Eliminar receta</Button>}
      </form>
    </Screen>
  );
}

// ─── Ingredients and waste ──────────────────────────────────────────────────
export function IngredientsPage() {
  const { ingredients, recipes, saveIngredients } = useStore();
  const [editing, setEditing] = useState(null);
  const current = useSticky(editing);
  const usedIn = (iid) => recipes.filter(r => r.items?.some(i => i.ingredient === iid));

  const save = (ing) => {
    const exists = ingredients.some(i => i.id === ing.id);
    saveIngredients(exists ? ingredients.map(i => (i.id === ing.id ? ing : i)) : [...ingredients, ing]);
    setEditing(null);
  };
  const remove = (ing) => {
    const used = usedIn(ing.id);
    if (used.length) { window.alert(`Se usa en ${used.map(r => r.name).join(', ')}. Quitalo de esas recetas primero.`); return; }
    if (!window.confirm(`¿Eliminar ${ing.name}?`)) return;
    saveIngredients(ingredients.filter(i => i.id !== ing.id));
    setEditing(null);
  };
  const sorted = [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <Screen title="Ingredientes" back={backToRecipes}
      actions={<IconButton icon={Plus} label="Nuevo ingrediente" dark onClick={() => setEditing({ name: '', unit: 'g', usable: 100 })} />}>
      <p className="px-1 text-[14px] text-muted-foreground">
        Aprovechable es cuánto queda después de pelar y limpiar. Si una piña de 1 kg deja 500 g limpios, es 50%. Los valores de arranque son típicos: pesá y ajustalos.
      </p>
      <Stack>
        {sorted.map(i => {
          const used = usedIn(i.id).length;
          return (
            <ListItem key={i.id} title={i.name} chevron onClick={() => setEditing(i)}
              subtitle={used ? `En ${used} receta${used !== 1 ? 's' : ''}` : 'Sin usar'}
              trailing={<Tag tone={usableOf(i) < 100 ? 'peach' : 'mint'}>{usableOf(i)}% aprovechable</Tag>} />
          );
        })}
      </Stack>

      <Sheet open={!!editing} onOpenChange={v => !v && setEditing(null)} title={current?.id ? current.name : 'Nuevo ingrediente'}
        confirm={{ label: 'Guardar', form: 'ingredient-form' }}>
        {current && <IngredientForm key={current.id || 'new'} ingredient={current} taken={ingredients.map(i => i.id)}
          onSave={save} onDelete={current.id ? () => remove(current) : null} />}
      </Sheet>
    </Screen>
  );
}

function IngredientForm({ ingredient, taken, onSave, onDelete }) {
  const [name, setName] = useState(ingredient.name);
  const [unit, setUnit] = useState(ingredient.unit || 'g');
  const [usable, setUsable] = useState(String(usableOf(ingredient)));
  const [whole, setWhole] = useState('');
  const [clean, setClean] = useState('');
  const [error, setError] = useState('');

  // Weighing one whole and once cleaned gives the percent.
  const weigh = (w, c) => {
    setWhole(w); setClean(c);
    const pct = Math.round((parseFloat(c) / parseFloat(w)) * 100);
    if (pct > 0 && pct <= 100) setUsable(String(pct));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    const pct = parseFloat(usable);
    if (!(pct > 0 && pct <= 100)) { setError('Aprovechable va de 1 a 100%'); return; }
    onSave({ id: ingredient.id || uniqueId(name, taken), name: name.trim(), unit, usable: pct });
  };

  const pct = parseFloat(usable);
  return (
    <form id="ingredient-form" onSubmit={submit} className="space-y-4">
      <TextField label="Nombre" placeholder="Piña" value={name} onChange={e => setName(e.target.value)} />
      <Chips value={unit} onChange={setUnit} options={[{ id: 'g', label: 'Gramos' }, { id: 'ml', label: 'Mililitros' }]} />
      <TextField label="Aprovechable (%)" type="number" inputMode="decimal" min="1" max="100" value={usable}
        onChange={e => setUsable(e.target.value)} />
      <Card tone="lime" className="space-y-3 p-4">
        <div className="text-[14px] font-semibold">¿No sabés el %? Pesá una entera y limpia</div>
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label={`Entera (${unit})`} type="number" inputMode="decimal" value={whole} onChange={e => weigh(e.target.value, clean)} />
          <TextField label={`Limpia (${unit})`} type="number" inputMode="decimal" value={clean} onChange={e => weigh(whole, e.target.value)} />
        </div>
        {pct > 0 && pct <= 100 && (
          <div className="text-[13px] text-foreground/70">
            Para tener 1 kg limpio hay que comprar {formatAmount(100000 / pct)}.
          </div>
        )}
      </Card>
      {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
      {onDelete && <Button type="button" variant="danger" onClick={onDelete}><Trash2 /> Eliminar ingrediente</Button>}
    </form>
  );
}
