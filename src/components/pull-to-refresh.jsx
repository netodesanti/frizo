import { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THRESHOLD = 72;
const MAX = 120;

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Fetches a newly deployed version, if any, so the reload shows it right away.
async function updateApp() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return;
  await reg.update();
  const sw = reg.installing || reg.waiting;
  if (!sw) return;
  await new Promise(resolve => {
    const timeout = setTimeout(resolve, 4000);
    sw.addEventListener('statechange', () => { if (sw.state === 'activated') { clearTimeout(timeout); resolve(); } });
  });
}

// Installed apps have no reload button, so pulling down at the top of a screen
// reloads. Browser tabs keep their own pull-to-refresh, so this only runs installed.
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);
  const distance = useRef(0);

  useEffect(() => {
    if (!standalone()) return;
    const set = (d) => { distance.current = d; setPull(d); };
    const cancel = () => { start.current = null; if (distance.current) set(0); };

    const onStart = (e) => {
      const blocked = window.scrollY > 0 || e.touches.length !== 1
        || document.querySelector('[role="dialog"]') || e.target.closest('[data-no-pull]');
      start.current = blocked ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onMove = (e) => {
      if (!start.current) return;
      const dx = e.touches[0].clientX - start.current.x;
      const dy = e.touches[0].clientY - start.current.y;
      // Sideways swipes (pill rows, cards) and scrolling up aren't pulls.
      if (Math.abs(dx) > Math.max(dy, 10) || window.scrollY > 0) { cancel(); return; }
      set(dy > 0 ? Math.min(MAX, dy * 0.5) : 0);
    };
    const onEnd = () => {
      if (!start.current) return;
      start.current = null;
      if (distance.current < THRESHOLD) { set(0); return; }
      set(THRESHOLD);
      setRefreshing(true);
      updateApp().catch(() => {}).finally(() => window.location.reload());
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', cancel);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', cancel);
    };
  }, []);

  if (!pull && !refreshing) return null;
  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[env(safe-area-inset-top)]">
      <div className={cn('flex size-11 items-center justify-center rounded-full shadow-float transition-colors duration-200',
        progress >= 1 ? 'bg-primary text-brand-lime' : 'bg-card text-foreground/60')}
        style={{ transform: `translateY(${pull - 28}px) scale(${0.6 + 0.4 * progress})`, opacity: Math.max(0.2, progress) }}>
        <RotateCw className={cn('size-5', refreshing && 'animate-spin')} strokeWidth={2.4}
          style={refreshing ? undefined : { transform: `rotate(${progress * 300}deg)` }} />
      </div>
    </div>
  );
}
