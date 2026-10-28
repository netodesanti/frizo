import { useEffect, useState } from 'react';

// Routes live in the URL hash ("orders/new", "settings/partners"…) so the phone's
// back button moves between screens. history.state.depth counts in-app steps, so
// a back button can pop to the previous screen instead of leaving the app.
const current = () => window.location.hash.slice(1) || 'dashboard';

export function navigate(route, { replace = false } = {}) {
  const depth = (window.history.state?.depth || 0) + (replace ? 0 : 1);
  window.history[replace ? 'replaceState' : 'pushState']({ depth }, '', `#${route}`);
  window.dispatchEvent(new Event('routechange'));
  if (!replace) window.scrollTo(0, 0);
}

export function goBack(fallback) {
  if (window.history.state?.depth > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const update = () => setRoute(current());
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    window.addEventListener('routechange', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      window.removeEventListener('routechange', update);
    };
  }, []);
  return route;
}
