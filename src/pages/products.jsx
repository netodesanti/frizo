import { useMemo, useRef, useState } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Camera, Plus, Rocket } from 'lucide-react';
import { db, storage } from '@/firebase';
import { useStore } from '@/lib/store';
import { money } from '@/lib/format';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Group, Row, ButtonRow, TextField, Stepper, Switch, FlavorTile, NavButton, BigButton,
} from '@/components/ios';

// Vercel deploy hook of the public website; rebuilds it with the latest products.
const WEB_DEPLOY_HOOK = import.meta.env.VITE_WEB_DEPLOY_HOOK;

const EMPTY = { name: '', emoji: '🥤', color: '#5cb85c', price: 1600, description: '', ingredients: '', active: true };

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'producto';

function StockCount({ value, onCommit }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft !== null && draft !== '') onCommit(parseInt(draft, 10) || 0);
    setDraft(null);
  };
  return (
    <input type="number" inputMode="numeric" value={draft ?? value}
      onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      className={cn('w-14 bg-transparent text-right text-[17px] font-semibold tabular-nums outline-none', value <= 0 && 'text-destructive')} />
  );
}

export function ProductsPage() {
  const { products, flavors, stock, setStockCount, bumpStockCount } = useStore();
  const [publish, setPublish] = useState('');
  const list = products || [];

  const publishSite = async () => {
    setPublish('Publicando…');
    try {
      await fetch(WEB_DEPLOY_HOOK, { method: 'POST', mode: 'no-cors' });
      setPublish('Listo. El sitio se actualiza en 1–2 minutos.');
    } catch {
      setPublish('No se pudo publicar. Intentá de nuevo.');
    }
  };

  return (
    <Screen title="Productos" actions={<NavButton icon={Plus} label="Nuevo producto" onClick={() => navigate('products/new')} />}>
      <Group header="Inventario" footer="Se descuenta solo al crear pedidos y vuelve si se cancelan o eliminan.">
        {flavors.map(f => (
          <Row key={f.id} leading={<FlavorTile flavor={f} />} title={f.name} subtitle="bolsas en stock">
            <StockCount value={stock[f.id] || 0} onCommit={n => setStockCount(f.id, n)} />
            <Stepper value={stock[f.id] || 0} min={-Infinity} onChange={v => bumpStockCount(f.id, v - (stock[f.id] || 0))} />
          </Row>
        ))}
      </Group>

      <Group header="Catálogo" footer="Lo que se muestra en el sitio web y en los pedidos.">
        {list.map(p => (
          <Row key={p.id} leading={<FlavorTile flavor={p} />} title={p.name} chevron onClick={() => navigate(`products/${p.id}`)}
            subtitle={`${money(p.price)} · ${p.active ? 'Visible en el sitio' : 'Oculto del sitio'}`}
            className={cn(!p.active && 'opacity-60')} />
        ))}
        <ButtonRow icon={Plus} onClick={() => navigate('products/new')}>Nuevo producto</ButtonRow>
      </Group>

      {WEB_DEPLOY_HOOK && (
        <Group footer={publish || 'Después de cambiar productos, publicá para actualizar el sitio web.'}>
          <ButtonRow icon={Rocket} onClick={publishSite}>Publicar cambios en el sitio</ButtonRow>
        </Group>
      )}
    </Screen>
  );
}

export function ProductPage({ id }) {
  const { products } = useStore();
  const list = products || [];
  const index = list.findIndex(p => p.id === id);
  const product = index >= 0 ? list[index] : null;
  const isNew = id === 'new';

  if (!isNew && !product) {
    return <Screen title="Producto" back={{ label: 'Productos', onClick: () => goBack('products') }} />;
  }
  return <ProductEditor key={id} product={product} index={index} products={list} />;
}

function ProductEditor({ product, index, products }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState(product
    ? { ...EMPTY, ...product, ingredients: (product.ingredients || []).join(', ') }
    : EMPTY);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : form.image), [file, form.image]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setBusy(true); setError('');
    try {
      let id = product?.id;
      if (!id) {
        const base = slugify(form.name);
        id = base;
        for (let n = 2; products.some(p => p.id === id); n++) id = `${base}-${n}`;
      }
      const data = {
        name: form.name.trim(),
        emoji: form.emoji.trim(),
        color: form.color,
        price: Number(form.price) || 0,
        description: form.description.trim(),
        ingredients: form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
        active: form.active,
        order: product ? product.order : products.length,
        image: product?.image || '',
        imagePath: product?.imagePath || '',
      };
      if (file) {
        const path = `products/${id}/${Date.now()}-${file.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, file, { contentType: file.type });
        if (data.imagePath) await deleteObject(ref(storage, data.imagePath)).catch(() => {});
        data.image = await getDownloadURL(r);
        data.imagePath = path;
      }
      await setDoc(doc(db, 'products', id), data);
      goBack('products');
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
      setBusy(false);
    }
  };

  const move = async (dir) => {
    const other = products[index + dir];
    if (!other) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', product.id), { order: other.order });
    batch.update(doc(db, 'products', other.id), { order: product.order });
    await batch.commit();
  };

  return (
    <Screen title={product ? product.name : 'Nuevo producto'} back={{ label: 'Productos', onClick: () => goBack('products') }}
      actions={<NavButton label={busy ? 'Guardando…' : 'Guardar'} bold type="submit" form="product-form" disabled={busy} />}>
      <form id="product-form" onSubmit={handleSave} className="space-y-7">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => fileRef.current.click()}
            className="relative flex size-28 items-center justify-center overflow-hidden rounded-3xl text-5xl"
            style={{ backgroundColor: `${form.color}26` }}>
            {preview ? <img src={preview} alt="" className="size-full object-cover" /> : form.emoji}
            <span className="absolute bottom-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
              <Camera className="size-4" />
            </span>
          </button>
          <button type="button" onClick={() => fileRef.current.click()} className="text-[15px] text-primary">
            {preview ? 'Cambiar foto' : 'Agregar foto'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
        </div>

        <Group>
          <TextField label="Nombre" align="right" placeholder="Batido Verde" value={form.name} onChange={set('name')} />
          <TextField label="Precio ₡" align="right" type="number" inputMode="numeric" value={form.price} onChange={set('price')} />
          <TextField label="Emoji" align="right" value={form.emoji} onChange={set('emoji')} />
          <Row title="Color">
            <input type="color" value={form.color} onChange={set('color')}
              className="h-8 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0" />
          </Row>
        </Group>

        <Group header="Descripción">
          <TextField multiline placeholder="Cómo se describe en el sitio web" value={form.description} onChange={set('description')} />
        </Group>
        <Group header="Ingredientes" footer="Separados por coma.">
          <TextField multiline placeholder="Espinaca, piña, jengibre" value={form.ingredients} onChange={set('ingredients')} />
        </Group>

        <Group>
          <Row title="Visible en el sitio web">
            <Switch checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
          </Row>
        </Group>

        {product && (
          <Group header="Orden en el sitio">
            <ButtonRow disabled={index === 0} onClick={() => move(-1)}>Mover arriba</ButtonRow>
            <ButtonRow disabled={index === products.length - 1} onClick={() => move(1)}>Mover abajo</ButtonRow>
          </Group>
        )}

        {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
        <BigButton type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</BigButton>
      </form>
    </Screen>
  );
}
