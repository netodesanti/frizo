export const money = (n) => `₡${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Local calendar day; toISOString() alone already says "tomorrow" after 6pm in Costa Rica.
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Expense and transfer dates are saved as UTC midnight of the chosen day, so read them back in UTC.
export const formatDay = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const monthOf = (iso) => {
  const s = new Date(iso).toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Orders store the moment they were created.
export const formatOrderDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
    + ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
};

export const formatRange = (from, to) => {
  const f = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  return from ? `${f(from)} – ${f(to)}` : `Hasta ${f(to)}`;
};

export const todayLong = () => {
  const s = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
