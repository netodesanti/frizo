import { useState } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Check, Navigation } from 'lucide-react';
import { useStore } from '@/lib/store';
import { STATUSES } from '@/lib/data';
import { navigate, goBack } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Screen, Group, Row, ButtonRow, BigButton } from '@/components/ios';

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
        <Group footer="Es el punto de salida de las rutas.">
          <ButtonRow onClick={() => navigate('settings/addresses')}>Configurar dirección de la fábrica</ButtonRow>
        </Group>
      )}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-6">
        <div className="overflow-hidden rounded-xl bg-card lg:sticky lg:top-16 lg:order-2">
          <GoogleMap mapContainerClassName="h-[45svh] w-full lg:h-[calc(100svh-6rem)]" zoom={12}
            center={origin || { lat: 9.9281, lng: -84.0907 }} options={{ disableDefaultUI: true, zoomControl: true }}>
            {directions && <DirectionsRenderer directions={directions} />}
            {!directions && origin && <Marker position={origin} label="F" />}
          </GoogleMap>
        </div>
        <div className="space-y-7 lg:order-1">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button key={s.id} onClick={() => toggleStatus(s.id)}
                className={cn('h-8 rounded-full px-3.5 text-[15px] font-medium transition-colors',
                  statusFilter.includes(s.id) ? 'bg-primary text-primary-foreground' : 'bg-segment text-foreground/80')}>
                {s.label}
              </button>
            ))}
          </div>

          <Group header={`Paradas · ${selectedIds.size} de ${eligible.length}`}
            footer={withoutCoords.length > 0 && `${withoutCoords.length} pedido${withoutCoords.length !== 1 ? 's' : ''} sin dirección en el mapa. Editalos para buscar la dirección.`}>
            {eligible.length === 0
              ? <Row title="No hay pedidos con dirección" subtitle="Probá con otros estados" />
              : (
                <>
                  <ButtonRow onClick={toggleAll}>{selectedIds.size === eligible.length ? 'Deseleccionar todo' : 'Seleccionar todo'}</ButtonRow>
                  {eligible.map(o => (
                    <Row key={o._id} title={o.customer} subtitle={o.location} onClick={() => toggleOrder(o._id)}>
                      <Check className={cn('size-5 shrink-0 text-primary', !selectedIds.has(o._id) && 'invisible')} strokeWidth={2.5} />
                    </Row>
                  ))}
                </>
              )}
          </Group>

          {error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
          <BigButton onClick={calculate} disabled={!origin || calculating || selectedIds.size === 0}>
            {calculating ? 'Calculando…' : `Calcular ruta (${selectedIds.size} parada${selectedIds.size !== 1 ? 's' : ''})`}
          </BigButton>

          {route && (
            <>
              <Group header={`Ruta · ${totalKm.toFixed(1)} km · ${totalMin} min`}>
                <Row leading={<StopBadge>F</StopBadge>} title="Fábrica" subtitle="Salida" />
                {stops.map((s, i) => (
                  <Row key={s.order._id} leading={<StopBadge>{i + 1}</StopBadge>} title={s.order.customer}
                    subtitle={`${s.leg.distance.text} · ${s.leg.duration.text}`} />
                ))}
                <Row leading={<StopBadge>{settings.returnLat ? 'R' : 'F'}</StopBadge>}
                  title={settings.returnLat ? settings.returnAddress : 'Regreso a la fábrica'}
                  subtitle={`${lastLeg.distance.text} · ${lastLeg.duration.text}`} />
              </Group>
              <BigButton variant="tinted" onClick={() => window.open(mapsLink, '_blank')}><Navigation /> Abrir en Google Maps</BigButton>
            </>
          )}
        </div>

      </div>
    </Screen>
  );
}

function StopBadge({ children }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
      {children}
    </span>
  );
}
