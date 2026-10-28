import { forwardRef, useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { statusOf } from '@/lib/data';

// Pastel surfaces with a matching ink color.
export const TONES = {
  lime:   { bg: '#eef6d8', fg: '#4f7a10' },
  mint:   { bg: '#e0f4e4', fg: '#23854a' },
  butter: { bg: '#fcf1cf', fg: '#a87400' },
  blush:  { bg: '#fde4ee', fg: '#d63d7a' },
  sky:    { bg: '#e0edfb', fg: '#2f73c9' },
  lilac:  { bg: '#ece7fc', fg: '#6a4fd8' },
  peach:  { bg: '#ffe9dc', fg: '#d2652a' },
  gray:   { bg: '#efede6', fg: '#6f7166' },
};
const tone = (t) => TONES[t] || TONES.gray;

export const STATUS_TONE = { pendiente: 'butter', preparando: 'sky', entregado: 'lilac', pagado: 'mint', cancelado: 'gray' };

const press = 'transition-transform duration-150 active:scale-[0.97]';

// ─── Screen ─────────────────────────────────────────────────────────────────
// Title row that picks up a frosted background once the page scrolls.
export function Screen({ title, eyebrow, back, actions, wide, children }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const width = wide ? 'max-w-5xl' : 'max-w-2xl';
  return (
    <div>
      <header className={cn('sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-all duration-300',
        scrolled ? 'bg-background/75 shadow-[0_1px_0_rgb(20_23_15/0.06)] backdrop-blur-xl' : '')}>
        <div className={cn('mx-auto flex min-h-16 items-center gap-3 px-5 py-2 md:px-8', width)}>
          {back && <IconButton icon={ChevronLeft} label={back.label} onClick={back.onClick} />}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="truncate text-[13px] font-medium text-muted-foreground">{eyebrow}</div>}
            <h1 className={cn('truncate font-display font-bold tracking-tight', back ? 'text-[22px]' : 'text-[28px] leading-tight')}>{title}</h1>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className={cn('stagger mx-auto space-y-7 px-5 pt-2 md:px-8', width)}>{children}</div>
    </div>
  );
}

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, dark, className, ...props }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40', press,
        dark ? 'bg-primary text-brand-lime shadow-float' : 'bg-card text-foreground shadow-soft', className)} {...props}>
      <Icon className="size-5" strokeWidth={2.2} />
    </button>
  );
});

export const PillButton = forwardRef(function PillButton({ children, icon: Icon, className, ...props }, ref) {
  return (
    <button ref={ref} type="button" className={cn('flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-card px-4 text-[14px] font-semibold shadow-soft', press, className)} {...props}>
      {Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
});

export function Button({ variant = 'primary', className, ...props }) {
  return (
    <button className={cn('flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-[16px] font-bold disabled:opacity-40 [&_svg]:size-5', press,
      variant === 'primary' && 'bg-primary text-white shadow-float',
      variant === 'lime' && 'bg-brand-lime text-brand-green',
      variant === 'secondary' && 'bg-card text-foreground shadow-soft',
      variant === 'danger' && 'bg-destructive/10 text-destructive',
      className)} {...props} />
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────
export function Section({ title, action, children, className }) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-1">
          {title && <h2 className="font-display text-[20px] font-bold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stack({ children, className }) {
  return <div className={cn('space-y-2.5', className)}>{children}</div>;
}

export function Card({ tone: t, onClick, className, children, style }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick}
      className={cn('block w-full rounded-[26px] text-left', t ? '' : 'bg-card shadow-soft', onClick && press, className)}
      style={t ? { backgroundColor: tone(t).bg, ...style } : style}>
      {children}
    </Comp>
  );
}

// One floating card per row.
export function ListItem({ icon: Icon, tone: t, leading, title, subtitle, meta, trailing, chevron, onClick, className, danger }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick}
      className={cn('flex w-full items-center gap-3.5 rounded-[22px] bg-card px-4 py-3.5 text-left shadow-soft', onClick && press, className)}>
      {Icon && <ToneIcon icon={Icon} tone={t} />}
      {leading}
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-[16px] font-semibold', danger && 'text-destructive')}>{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</div>}
        {meta && <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div>}
      </div>
      {trailing}
      {chevron && <ChevronRight className="size-5 shrink-0 text-muted-foreground/70" />}
    </Comp>
  );
}

export function ToneIcon({ icon: Icon, tone: t, size = 44 }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: tone(t).bg, color: tone(t).fg, width: size, height: size }}>
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2.1} />
    </span>
  );
}

export function StatTile({ icon: Icon, tone: t, label, value, unit, onClick }) {
  const c = tone(t);
  return (
    <Card tone={t} onClick={onClick} className="flex min-h-40 flex-col p-4">
      <Icon className="size-6" style={{ color: c.fg }} strokeWidth={2.1} />
      <div className="mt-3 text-[15px] font-semibold">{label}</div>
      <div className="mt-1 truncate font-display text-[30px] font-bold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="mt-auto flex items-end justify-between pt-2">
        <span className="text-[13px] text-foreground/55">{unit}</span>
        {onClick && (
          <span className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-foreground/80">
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </span>
        )}
      </div>
    </Card>
  );
}

// ─── Small pieces ───────────────────────────────────────────────────────────
export function Tag({ tone: t, children, className }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold', className)}
      style={{ backgroundColor: tone(t).bg, color: tone(t).fg }}>
      {children}
    </span>
  );
}

export function StatusTag({ status }) {
  const s = statusOf(status);
  return <Tag tone={STATUS_TONE[s.id]}>{s.label}</Tag>;
}

const AVATAR_TONES = ['lime', 'sky', 'blush', 'butter', 'lilac', 'peach', 'mint'];
export function Avatar({ name = '', size = 44, className }) {
  const t = tone(AVATAR_TONES[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_TONES.length]);
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full font-display font-bold', className)}
      style={{ backgroundColor: t.bg, color: t.fg, width: size, height: size, fontSize: size * 0.42 }}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

export function FlavorTile({ flavor, size = 44 }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl"
      style={{ backgroundColor: `${flavor.color}24`, width: size, height: size, fontSize: size * 0.5 }}>
      {flavor.image ? <img src={flavor.image} alt="" className="size-full object-cover" /> : flavor.emoji}
    </span>
  );
}

// Pill tabs: the active one is filled dark green. `value` may be a list for multi-select.
export function Chips({ options, value, onChange, className }) {
  const isOn = (id) => (Array.isArray(value) ? value.includes(id) : value === id);
  return (
    <div className={cn('no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0', className)}>
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn('h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors duration-200',
            isOn(o.id) ? 'bg-primary text-white' : 'bg-card text-foreground/70 shadow-soft')}>
          {o.label}
          {o.count != null && <span className={cn('ml-1.5', isOn(o.id) ? 'text-brand-lime' : 'text-muted-foreground')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, showValue = true }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-muted p-1">
      <button type="button" aria-label="Menos" disabled={value <= min} onClick={() => onChange(value - 1)}
        className={cn('flex size-8 items-center justify-center rounded-full bg-card shadow-soft disabled:opacity-30', press)}>
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      {showValue && <span className="min-w-7 text-center font-display text-[17px] font-bold tabular-nums">{value}</span>}
      <button type="button" aria-label="Más" onClick={() => onChange(value + 1)}
        className={cn('flex size-8 items-center justify-center rounded-full bg-primary text-brand-lime', press)}>
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-primary' : 'bg-input')}>
      <span className={cn('absolute left-1 top-1 size-5 rounded-full shadow transition-all duration-200', checked ? 'translate-x-5 bg-brand-lime' : 'bg-white')} />
    </button>
  );
}

// ─── Fields ─────────────────────────────────────────────────────────────────
// Each field is its own white card with a small label on top.
export const TextField = forwardRef(function TextField({ label, multiline, className, ...props }, ref) {
  const Comp = multiline ? 'textarea' : 'input';
  return (
    <label className="block rounded-[20px] bg-card px-4 py-3 shadow-soft focus-within:ring-2 focus-within:ring-brand-lime">
      {label && <span className="block text-[12px] font-semibold text-muted-foreground">{label}</span>}
      <Comp ref={ref} rows={multiline ? 3 : undefined}
        className={cn('w-full bg-transparent text-[16px] font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/80',
          multiline ? 'resize-none' : 'h-7', className)}
        {...props} />
    </label>
  );
});

export function SelectField({ label, value, onChange, options }) {
  const current = options.find(o => o.value === value);
  return (
    <label className="relative flex items-center rounded-[20px] bg-card px-4 py-3 shadow-soft">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-muted-foreground">{label}</span>
        <span className="block h-7 truncate text-[16px] font-medium leading-7">{current?.label}</span>
      </span>
      <ChevronDown className="size-5 text-muted-foreground" />
      <select value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function DateField({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[20px] bg-card px-4 py-3 shadow-soft">
      <span className="text-[16px] font-semibold">{label}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="rounded-full bg-muted px-3 py-1.5 text-[15px] font-medium outline-none" />
    </label>
  );
}

export function AmountField({ value, onChange, autoFocus }) {
  const len = Math.max(String(value || '').length, 1);
  return (
    <label className="grain flex items-baseline justify-center gap-1 overflow-hidden rounded-[28px] bg-brand-lime px-4 py-6 text-brand-green">
      <span className="font-display text-[32px] font-bold opacity-70">₡</span>
      <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" autoFocus={autoFocus}
        value={value} onChange={e => onChange(e.target.value)} style={{ width: `${len + 0.5}ch` }}
        className="min-w-[2ch] max-w-full bg-transparent font-display text-[56px] font-bold leading-none tracking-tight tabular-nums outline-none placeholder:text-brand-green/35" />
    </label>
  );
}

export function SearchField({ value, onChange, placeholder = 'Buscar' }) {
  return (
    <label className="flex h-12 items-center gap-2 rounded-full bg-card px-4 text-muted-foreground shadow-soft focus-within:ring-2 focus-within:ring-brand-lime">
      <Search className="size-5 shrink-0" />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Borrar" className="flex size-6 items-center justify-center rounded-full bg-muted">
          <X className="size-3.5" strokeWidth={3} />
        </button>
      )}
    </label>
  );
}

export function EmptyState({ emoji = '🥤', title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-card px-6 py-10 text-center shadow-soft">
      <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-[#eef6d8] text-3xl">{emoji}</div>
      <div className="font-display text-[20px] font-bold">{title}</div>
      {children && <p className="mt-1 max-w-xs text-[14px] text-muted-foreground">{children}</p>}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}

export function LinkButton({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[14px] font-semibold text-primary">
      {children} <ArrowRight className="size-4" />
    </button>
  );
}

// ─── Sheet ──────────────────────────────────────────────────────────────────
// Slides up on phones, centered on desktop. `confirm` becomes the big button at
// the bottom ({ label, onClick, form, disabled }); `onBack` swaps X for a back arrow.
export function Sheet({ open, onOpenChange, title, confirm, onBack, children }) {
  const isMobile = useIsMobile();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#14170f]/35 backdrop-blur-[2px] duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content aria-describedby={undefined}
          className={cn('fixed z-50 flex flex-col bg-sheet text-foreground shadow-2xl outline-none',
            isMobile
              ? 'inset-x-0 bottom-0 max-h-[94svh] rounded-t-[32px] duration-300 ease-out data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom'
              : 'left-1/2 top-1/2 max-h-[88vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[32px] duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95')}>
          {isMobile && <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-foreground/15" />}
          <div className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-6">
            {onBack && <IconButton icon={ChevronLeft} label="Atrás" onClick={onBack} className="size-10" />}
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate font-display text-[22px] font-bold tracking-tight">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton icon={X} label="Cerrar" className="size-10" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">{children}</div>
          {confirm && (
            <div className="shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
              <Button type={confirm.form ? 'submit' : 'button'} form={confirm.form} onClick={confirm.onClick} disabled={confirm.disabled}>
                {confirm.label}
              </Button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────────
// Keeps the last non-null value so a sheet's content stays put while it animates closed.
export function useSticky(value) {
  const [kept, setKept] = useState(value);
  useEffect(() => { if (value) setKept(value); }, [value]);
  return value || kept;
}

// Animates a number from its previous value to the new one.
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setValue(target); return; }
    const start = performance.now();
    const origin = from.current;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const v = origin + (target - origin) * (1 - (1 - t) ** 3);
      setValue(v);
      from.current = v;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
