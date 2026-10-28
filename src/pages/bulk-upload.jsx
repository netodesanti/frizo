import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, MinusCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { BASE_FLAVORS, DEFAULT_PRICE, newId } from '@/lib/data';
import { money } from '@/lib/format';
import { navigate, goBack } from '@/lib/nav';
import { Screen, Group, Row, BigButton } from '@/components/ios';

const COLUMN_MAP = {
  'nombre': 'customer', 'batido verde': 'verde', 'antioxidante': 'antioxidante',
  'boost inmune': 'boost', 'ubicacion': 'location', 'ubicación': 'location', 'notas': 'notes',
};

export function BulkUploadPage() {
  const { stock, placeOrders } = useStore();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleFile = (e) => {
    setError(''); setRows([]);
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (json.length === 0) { setError('El archivo está vacío.'); return; }
        const headers = Object.keys(json[0]);
        const colMap = {};
        for (const h of headers) { const key = h.trim().toLowerCase(); if (COLUMN_MAP[key]) colMap[h] = COLUMN_MAP[key]; }
        if (!Object.values(colMap).includes('customer')) { setError('No se encontró la columna "Nombre".'); return; }
        const cell = (row, field) => row[headers.find(h => colMap[h] === field)];
        const parsed = json.map(row => {
          const quantities = Object.fromEntries(BASE_FLAVORS.map(f => [f.id, parseInt(cell(row, f.id) || 0, 10) || 0]));
          return {
            customer: String(cell(row, 'customer') || '').trim(),
            location: String(cell(row, 'location') || '').trim(),
            notes: String(cell(row, 'notes') || '').trim(),
            quantities,
            totalBags: Object.values(quantities).reduce((a, b) => a + b, 0),
          };
        }).filter(r => r.customer && r.totalBags > 0);
        if (parsed.length === 0) { setError('No se encontraron pedidos válidos en el archivo.'); return; }
        setRows(parsed);
      } catch { setError('No se pudo leer el archivo. Asegurate de que sea un .xlsx o .xls válido.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const totals = Object.fromEntries(BASE_FLAVORS.map(f => [f.id, rows.reduce((s, r) => s + r.quantities[f.id], 0)]));
  const totalBags = rows.reduce((s, r) => s + r.totalBags, 0);
  const short = BASE_FLAVORS.filter(f => totals[f.id] > (stock[f.id] || 0));

  const submit = () => {
    placeOrders(rows.map(r => ({
      ...r, id: newId(), pricePerBag: DEFAULT_PRICE, totalPrice: r.totalBags * DEFAULT_PRICE,
      status: 'pendiente', date: new Date().toISOString(),
    })));
    navigate('orders', { replace: true });
  };

  return (
    <Screen title="Importar pedidos" back={{ label: 'Pedidos', onClick: () => goBack('orders') }}>
      <Group footer={<>Columnas: <b>Nombre</b>, <b>Batido Verde</b>, <b>Antioxidante</b>, <b>Boost Inmune</b>. Opcionales: <b>Ubicación</b>, <b>Notas</b>.</>}>
        <Row icon={FileSpreadsheet} iconColor="#34c759" title={fileName || 'Elegir archivo de Excel'} subtitle={fileName ? 'Tocá para elegir otro' : '.xlsx o .xls'}
          chevron onClick={() => fileRef.current.click()} />
      </Group>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />

      {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}

      {rows.length > 0 && (
        <>
          <Group header={`${rows.length} pedido${rows.length !== 1 ? 's' : ''} · ${totalBags} bolsas`}
            footer={short.length > 0 && <span className="text-destructive">El stock quedará en negativo para {short.map(f => f.name).join(', ')}.</span>}>
            {rows.map((r, i) => (
              <Row key={i} title={r.customer}
                subtitle={[BASE_FLAVORS.filter(f => r.quantities[f.id]).map(f => `${f.emoji} ${r.quantities[f.id]}`).join('  '), r.location].filter(Boolean).join(' · ')}>
                <button type="button" aria-label={`Quitar ${r.customer}`} onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}>
                  <MinusCircle className="size-[22px] fill-destructive text-white" />
                </button>
              </Row>
            ))}
          </Group>
          <BigButton onClick={submit}>Crear {rows.length} pedido{rows.length !== 1 ? 's' : ''} · {money(totalBags * DEFAULT_PRICE)}</BigButton>
        </>
      )}
    </Screen>
  );
}
