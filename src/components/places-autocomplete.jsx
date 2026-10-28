import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const loaded = () => !!window.google?.maps?.places?.PlaceAutocompleteElement;

// Google Places search box. Until the Maps script loads (or if it can't, e.g.
// offline) it falls back to a plain text field without coordinates.
export function PlacesAutocomplete({ onSelect, placeholder, className }) {
  const containerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(loaded);
  const [text, setText] = useState('');

  useEffect(() => {
    if (ready) return;
    const interval = setInterval(() => { if (loaded()) { setReady(true); clearInterval(interval); } }, 200);
    return () => clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const el = new window.google.maps.places.PlaceAutocompleteElement({});
    el.includedRegionCodes = ['cr'];
    el.placeholder = placeholder || '';
    el.addEventListener('gmp-select', async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
      onSelectRef.current(place.formattedAddress, place.location.lat(), place.location.lng());
    });
    containerRef.current.appendChild(el);
    return () => el.remove();
  }, [ready, placeholder]);

  if (!ready) {
    return (
      <input value={text} placeholder={placeholder}
        onChange={e => setText(e.target.value)}
        onBlur={() => text.trim() && onSelect(text.trim(), null, null)}
        className={cn('h-11 w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70', className)} />
    );
  }
  return <div ref={containerRef} className={cn('places-autocomplete-wrap', className)} />;
}
