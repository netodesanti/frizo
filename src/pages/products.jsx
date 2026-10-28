import { useMemo, useRef, useState } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { ArrowDown, ArrowUp, Camera, Plus, Rocket } from 'lucide-react';
import { db, storage } from '@/firebase';
import { useStore } from '@/lib/store';
import { money } from '@/lib/format';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import {
  Screen, Section, Stack, Card, ListItem, TextField, Stepper, Toggle, FlavorTile, Tag, IconButton, Button,
} from '@/components/kit';

// Vercel deploy hook of the public website; rebuilds it with the latest products.
const WEB_DEPLOY_HOOK = import.meta.env.VITE_WEB_DEPLOY_HOOK;

const EMPTY = { name: '', emoji: '🥤', color: '#5cb85c', price: 1600, description: '', ingredients: '', active: true };

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'producto';

// Big tappable number; typing a value replaces the count.
function StockCount({ value, onCommit }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft !== null && draft !== '') onCommit(parseInt(draft, 10) || 0);
    setDraft(null);
  };
  return (
    <input type="number" inputMode="numeric" aria-label="Bolsas en stock" value={draft ?? value}
      onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      className={cn('w-full bg-transparent font-display text-[40px] font-bold leading-none tracking-tight tabular-nums outline-none', value <= 0 && 'text-destructive')} />
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
    <Screen title="Productos" eyebrow={`${flavors.reduce((s, f) => s + (stock[f.id] || 0), 0)} bolsas en stock`}
      actions={<IconButton icon={Plus} label="Nuevo producto" dark onClick={() => navigate('products/new')} />}>
      <Section title="Inventario">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {flavors.map(f => {
            const n = stock[f.id] || 0;
            return (
              <Card key={f.id} className="flex flex-col p-4" style={{ background: `linear-gradient(180deg, ${f.color}1c, #fff 70%)` }}>
                <div className="flex items-start justify-between">
                  <FlavorTile flavor={f} size={48} />
                  {n <= 3 && <Tag tone="blush">{n <= 0 ? 'Agotado' : 'Poco'}</Tag>}
                </div>
                <div className="mt-3 truncate text-[14px] font-semibold">{f.name}</div>
                <StockCount value={n} onCommit={v => setStockCount(f.id, v)} />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[12px] text-muted-foreground">bolsas</span>
                  <Stepper value={n} min={-Infinity} showValue={false} onChange={v => bumpStockCount(f.id, v - n)} />
                </div>
              </Card>
            );
          })}
        </div>
        <p className="px-1 text-[13px] text-muted-foreground">Se descuenta solo al crear pedidos y vuelve si se cancelan o eliminan.</p>
      </Section>

      <Section title="Catálogo">
        <Stack>
          {list.map(p => (
            <ListItem key={p.id} leading={<FlavorTile flavor={p} size={52} />} title={p.name} subtitle={p.description || 'Sin descripción'}
              meta={<><Tag tone="lime">{money(p.price)}</Tag><Tag tone={p.active ? 'mint' : 'gray'}>{p.active ? 'En el sitio' : 'Oculto'}</Tag></>}
              chevron onClick={() => navigate(`products/${p.id}`)} />
          ))}
          <button type="button" onClick={() => navigate('products/new')}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-input py-4 text-[15px] font-semibold text-muted-foreground transition-transform active:scale-[0.98]">
            <Plus className="size-5" /> Nuevo producto
          </button>
        </Stack>
      </Section>

      {WEB_DEPLOY_HOOK && (
        <ListItem icon={Rocket} tone="lilac" title="Publicar cambios en el sitio" subtitle={publish || 'Actualiza el sitio web con estos productos'}
          chevron onClick={publishSite} />
      )}
    </Screen>
  );
}

export function ProductPage({ id }) {
  const { products } = useStore();
  const list = products || [];
  const index = list.findIndex(p => p.id === id);
  const product = index >= 0 ? list[index] : null;

  if (id !== 'new' && !product) {
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
    <Screen title={product ? product.name : 'Nuevo producto'} back={{ label: 'Productos', onClick: () => goBack('products') }}>
      <form onSubmit={handleSave} className="space-y-5">
        <button type="button" onClick={() => fileRef.current.click()}
          className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-[30px] text-[96px] transition-transform active:scale-[0.99]"
          style={{ background: `radial-gradient(circle at 50% 40%, ${form.color}40, ${form.color}14 70%)` }}>
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span className="drop-shadow-xl">{form.emoji || '🥤'}</span>}
          <span className="absolute bottom-3 right-3 flex h-10 items-center gap-2 rounded-full bg-white/90 px-4 text-[14px] font-semibold shadow-soft backdrop-blur">
            <Camera className="size-4" /> {preview ? 'Cambiar foto' : 'Agregar foto'}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />

        <TextField label="Nombre" placeholder="Batido Verde" value={form.name} onChange={set('name')} />
        <div className="grid grid-cols-3 gap-2.5">
          <TextField label="Precio ₡" type="number" inputMode="numeric" value={form.price} onChange={set('price')} />
          <TextField label="Emoji" value={form.emoji} onChange={set('emoji')} />
          <label className="block rounded-[20px] bg-card px-4 py-3 shadow-soft">
            <span className="block text-[12px] font-semibold text-muted-foreground">Color</span>
            <input type="color" value={form.color} onChange={set('color')}
              className="mt-0.5 h-7 w-full cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0" />
          </label>
        </div>
        <TextField label="Descripción" multiline placeholder="Cómo se describe en el sitio web" value={form.description} onChange={set('description')} />
        <TextField label="Ingredientes (separados por coma)" multiline placeholder="Espinaca, piña, jengibre" value={form.ingredients} onChange={set('ingredients')} />

        <Card className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1">
            <div className="text-[16px] font-semibold">Visible en el sitio web</div>
            <div className="text-[13px] text-muted-foreground">Si lo apagás, sigue disponible para pedidos</div>
          </div>
          <Toggle checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
        </Card>

        {product && (
          <Card className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 text-[16px] font-semibold">Orden en el sitio</div>
            <IconButton icon={ArrowUp} label="Mover arriba" disabled={index === 0} onClick={() => move(-1)} className="size-10 bg-muted shadow-none" />
            <IconButton icon={ArrowDown} label="Mover abajo" disabled={index === products.length - 1} onClick={() => move(1)} className="size-10 bg-muted shadow-none" />
          </Card>
        )}

        {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</Button>
      </form>
    </Screen>
  );
}
