import { useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Check, Factory, Navigation } from 'lucide-react';
import { useStore } from '@/lib/store';
import { STATUSES } from '@/lib/data';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Screen, Section, Stack, Card, ListItem, Chips, Button, Avatar, LinkButton } from '@/components/kit';

const point = (lat, lng) => `${lat},${lng}`;

export function RoutesPage() {
  const { orders, settings } = useStore();
  const [statusFilter, setStatusFilter] = useState(['pendiente', 'preparando']);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [directions, setDirections] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  const inFilter = (o) => statusFilter.includes(o.status || 'pendiente');
  const eligible = orders.filter(o => inFilter(o) && o.lat && o.lng);
  const withoutCoords = orders.filter(o => inFilter(o) && (!o.lat || !o.lng));
  const selected = orders.filter(o => selectedIds.has(o._id));
  const origin = settings.factoryLat ? { lat: settings.factoryLat, lng: settings.factoryLng } : null;
  const returnPoint = settings.returnLat ? { lat: settings.returnLat, lng: settings.returnLng } : origin;

  const reset = () => { setDirections(null); setError(''); };
  const toggleOrder = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    reset();
  };
  const toggleAll = () => { setSelectedIds(selectedIds.size === eligible.length ? new Set() : new Set(eligible.map(o => o._id))); reset(); };
  const toggleStatus = (id) => {
    setStatusFilter(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    setSelectedIds(new Set()); reset();
  };

  const calculate = () => {
    if (selected.length > 23) { setError('Máximo 23 paradas por ruta (límite de Google Maps).'); return; }
    setError(''); setCalculating(true);
    new window.google.maps.DirectionsService().route({
      origin, destination: returnPoint, travelMode: 'DRIVING',
      waypoints: selected.map(o => ({ location: { lat: o.lat, lng: o.lng }, stopover: true })),
      optimizeWaypoints: selected.length > 1,
    }, (result, status) => {
      if (status === 'OK') setDirections(result);
      else setError('Error calculando la ruta: ' + status);
      setCalculating(false);
    });
  };

  const route = directions?.routes[0];
  const stops = route ? route.waypoint_order.map((idx, i) => ({ order: selected[idx], leg: route.legs[i] })) : [];
  const lastLeg = route?.legs[route.legs.length - 1];
  const totalKm = route ? route.legs.reduce((s, l) => s + l.distance.value, 0) / 1000 : 0;
  const totalMin = route ? Math.round(route.legs.reduce((s, l) => s + l.duration.value, 0) / 60) : 0;
  const mapsLink = route && `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${point(origin.lat, origin.lng)}`
    + `&destination=${point(returnPoint.lat, returnPoint.lng)}`
    + `&waypoints=${stops.map(s => point(s.order.lat, s.order.lng)).join('|')}`;

  return (
    <Screen title="Rutas" wide back={{ label: 'Pedidos', onClick: () => goBack('orders') }}>
      {!origin && (
        <ListItem icon={Factory} tone="butter" title="Configurá la fábrica" subtitle="Es el punto de salida de las rutas" chevron
          onClick={() => navigate('settings/addresses')} />
      )}

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-6">
        <div data-no-pull className="lg:sticky lg:top-20 lg:order-2">
          <Card className="overflow-hidden p-1.5">
            <div className="overflow-hidden rounded-[22px]">
              <GoogleMap mapContainerClassName="h-[42svh] w-full lg:h-[calc(100svh-8rem)]" zoom={12}
                center={origin || { lat: 9.9281, lng: -84.0907 }} options={{ disableDefaultUI: true, zoomControl: true }}>
                {directions && <DirectionsRenderer directions={directions} />}
                {!directions && origin && <Marker position={origin} label="F" />}
              </GoogleMap>
            </div>
          </Card>
        </div>

        <div className="space-y-7 lg:order-1">
          {route && (
            <div className="grain overflow-hidden rounded-[28px] bg-primary p-5 text-white shadow-float">
              <div className="text-[13px] text-white/60">Ruta optimizada</div>
              <div className="font-display text-[34px] font-bold leading-tight text-brand-lime">{totalKm.toFixed(1)} km · {totalMin} min</div>
              <div className="mt-4 space-y-2.5">
                <Stop n="F" title="Fábrica" sub="Salida" />
                {stops.map((s, i) => <Stop key={s.order._id} n={i + 1} title={s.order.customer} sub={`${s.leg.distance.text} · ${s.leg.duration.text}`} />)}
                <Stop n={settings.returnLat ? 'R' : 'F'} title={settings.returnLat ? settings.returnAddress : 'Regreso a la fábrica'}
                  sub={`${lastLeg.distance.text} · ${lastLeg.duration.text}`} />
              </div>
              <Button variant="lime" className="mt-5" onClick={() => window.open(mapsLink, '_blank')}><Navigation /> Abrir en Google Maps</Button>
            </div>
          )}

          <Chips value={statusFilter} onChange={toggleStatus} options={STATUSES.map(s => ({ id: s.id, label: s.label }))} />

          <Section title={`Paradas · ${selectedIds.size}/${eligible.length}`}
            action={eligible.length > 0 && <LinkButton onClick={toggleAll}>{selectedIds.size === eligible.length ? 'Ninguna' : 'Todas'}</LinkButton>}>
            {eligible.length === 0
              ? <p className="px-1 text-[14px] text-muted-foreground">No hay pedidos con dirección en estos estados.</p>
              : (
                <Stack>
                  {eligible.map(o => {
                    const on = selectedIds.has(o._id);
                    return (
                      <ListItem key={o._id} leading={<Avatar name={o.customer} />} title={o.customer} subtitle={o.location}
                        onClick={() => toggleOrder(o._id)} className={cn(on && 'ring-2 ring-brand-lime')}
                        trailing={
                          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full transition-colors', on ? 'bg-primary text-brand-lime' : 'bg-muted text-transparent')}>
                            <Check className="size-4" strokeWidth={3} />
                          </span>
                        } />
                    );
                  })}
                </Stack>
              )}
            {withoutCoords.length > 0 && (
              <p className="px-1 text-[13px] text-muted-foreground">
                {withoutCoords.length} pedido{withoutCoords.length !== 1 ? 's' : ''} sin dirección en el mapa. Editalos para buscar la dirección.
              </p>
            )}
          </Section>

          {error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
          <Button onClick={calculate} disabled={!origin || calculating || selectedIds.size === 0}>
            {calculating ? 'Calculando…' : `Calcular ruta · ${selectedIds.size} parada${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Screen>
  );
}

function Stop({ n, title, sub }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-lime text-[13px] font-bold text-brand-green">{n}</span>
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold">{title}</div>
        <div className="text-[12px] text-white/60">{sub}</div>
      </div>
    </div>
  );
}
