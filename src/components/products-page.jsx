import { useState } from 'react';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Rocket } from 'lucide-react';
import { db, storage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Vercel deploy hook of the public website; rebuilds it with the latest products.
const WEB_DEPLOY_HOOK = import.meta.env.VITE_WEB_DEPLOY_HOOK;

const EMPTY = { name: '', emoji: '🥤', color: '#5cb85c', price: 1600, description: '', ingredients: '', active: true };

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
	.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'producto';

function Field({ label, children }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
			{children}
		</label>
	);
}

function ProductForm({ product, products, onDone }) {
	const [form, setForm] = useState(product
		? { ...EMPTY, ...product, ingredients: (product.ingredients || []).join(', ') }
		: EMPTY);
	const [file, setFile] = useState(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

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
			onDone();
		} catch (err) {
			setError(err.message || 'No se pudo guardar');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card>
			<CardContent className="pt-6">
				<form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
					<Field label="Nombre"><Input value={form.name} onChange={set('name')} /></Field>
					<div className="grid grid-cols-3 gap-3">
						<Field label="Emoji"><Input value={form.emoji} onChange={set('emoji')} /></Field>
						<Field label="Color"><Input type="color" value={form.color} onChange={set('color')} className="p-1" /></Field>
						<Field label="Precio ₡"><Input type="number" min="0" value={form.price} onChange={set('price')} /></Field>
					</div>
					<Field label="Descripción">
						<textarea value={form.description} onChange={set('description')} rows={3}
							className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none" />
					</Field>
					<Field label="Ingredientes (separados por coma)">
						<textarea value={form.ingredients} onChange={set('ingredients')} rows={3}
							className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none" />
					</Field>
					<Field label="Foto">
						<div className="flex items-center gap-3">
							{(file || form.image) && (
								<img src={file ? URL.createObjectURL(file) : form.image} alt="" className="h-16 w-16 rounded-md object-cover border" />
							)}
							<Input type="file" accept="image/*" onChange={e => setFile(e.target.files[0] || null)} />
						</div>
					</Field>
					<label className="flex items-center gap-2 text-sm self-end pb-2">
						<input type="checkbox" checked={form.active} onChange={set('active')} />
						Visible en el sitio web
					</label>
					{error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
					<div className="flex gap-2 md:col-span-2">
						<Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
						<Button type="button" variant="outline" onClick={onDone}>Cancelar</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

export function ProductsPage({ products }) {
	const [editing, setEditing] = useState(null); // product, 'new' or null
	const [publish, setPublish] = useState('');

	const move = async (i, dir) => {
		const a = products[i], b = products[i + dir];
		if (!b) return;
		const batch = writeBatch(db);
		batch.update(doc(db, 'products', a.id), { order: b.order });
		batch.update(doc(db, 'products', b.id), { order: a.order });
		await batch.commit();
	};

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
		<div>
			<div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
				<div>
					<h1 className="font-heading font-extrabold text-3xl text-foreground">Productos</h1>
					<p className="text-muted-foreground text-sm mt-1">Lo que se muestra en el sitio web y en los pedidos</p>
				</div>
				<div className="flex gap-2 items-center flex-wrap">
					{WEB_DEPLOY_HOOK && (
						<Button variant="outline" onClick={publishSite}><Rocket /> Publicar cambios en el sitio</Button>
					)}
					<Button onClick={() => setEditing('new')}><Plus /> Nuevo producto</Button>
				</div>
			</div>
			{publish && <p className="text-sm text-muted-foreground mb-4">{publish}</p>}

			{editing && (
				<div className="mb-6">
					<ProductForm key={editing === 'new' ? 'new' : editing.id} product={editing === 'new' ? null : editing}
						products={products} onDone={() => setEditing(null)} />
				</div>
			)}

			<div className="grid gap-3">
				{products.map((p, i) => (
					<Card key={p.id} className={p.active ? '' : 'opacity-60'}>
						<CardContent className="py-4 flex items-center gap-4">
							<div className="h-14 w-14 shrink-0 rounded-md border overflow-hidden flex items-center justify-center text-2xl"
								style={{ backgroundColor: `${p.color}1f` }}>
								{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : p.emoji}
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-heading font-extrabold flex items-center gap-2">
									<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
									{p.name}
									{!p.active && <Badge variant="outline">Oculto</Badge>}
								</div>
								<div className="text-xs text-muted-foreground truncate">₡{(p.price || 0).toLocaleString()} · {p.description || 'Sin descripción'}</div>
							</div>
							<div className="flex gap-1">
								<Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
								<Button variant="ghost" size="icon" disabled={i === products.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
								<Button variant="ghost" size="icon" title={p.active ? 'Ocultar del sitio' : 'Mostrar en el sitio'}
									onClick={() => updateDoc(doc(db, 'products', p.id), { active: !p.active })}>
									{p.active ? <Eye /> : <EyeOff />}
								</Button>
								<Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil /></Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
			{!products.length && <p className="text-sm text-muted-foreground"><ImagePlus className="inline mr-1 h-4 w-4" />Cargando productos…</p>}
		</div>
	);
}
