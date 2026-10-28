import { forwardRef, useEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronLeft, ChevronRight, ChevronsUpDown, Minus, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { statusOf } from '@/lib/data';

// ─── Screen ─────────────────────────────────────────────────────────────────
// A navigation-bar screen: the large title scrolls away and a compact title
// fades into the translucent bar, like UINavigationController.
export function Screen({ title, subtitle, back, actions, wide, children }) {
  const titleRef = useRef(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(titleRef.current);
    return () => io.disconnect();
  }, []);

  const width = wide ? 'max-w-5xl' : 'max-w-2xl';
  return (
    <div>
      <header className={cn('sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-colors duration-200',
        compact ? 'border-b border-separator/70 bg-bar backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent bg-background')}>
        <div className={cn('relative mx-auto flex h-11 items-center px-2 md:px-6', width)}>
          <div className="flex min-w-0 flex-1 items-center">
            {back && (
              <button onClick={back.onClick} className="-ml-1 flex min-w-0 items-center text-[17px] text-primary active:opacity-50">
                <ChevronLeft className="size-7 shrink-0" strokeWidth={2.25} />
                <span className="truncate">{back.label}</span>
              </button>
            )}
          </div>
          <div className={cn('pointer-events-none absolute left-1/2 max-w-[55%] -translate-x-1/2 truncate text-[17px] font-semibold transition-opacity duration-200',
            compact ? 'opacity-100' : 'opacity-0')}>
            {title}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1">{actions}</div>
        </div>
      </header>
      <div className={cn('mx-auto px-4 md:px-8', width)}>
        <div ref={titleRef} className="px-1 pb-5 pt-1">
          <h1 className="text-[34px] font-bold leading-[1.15] tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="space-y-7">{children}</div>
      </div>
    </div>
  );
}

export const NavButton = forwardRef(function NavButton({ icon: Icon, label, bold, className, ...props }, ref) {
  return (
    <button ref={ref} aria-label={label} className={cn('flex h-9 items-center justify-center rounded-full text-[17px] text-primary active:opacity-50 disabled:opacity-30',
      Icon ? 'w-9' : 'px-2', bold && 'font-semibold', className)} {...props}>
      {Icon ? <Icon className="size-[22px]" strokeWidth={2} /> : label}
    </button>
  );
});

// ─── Grouped lists ──────────────────────────────────────────────────────────
// Rows draw their own inset separator ([data-sep]); the first row in a group hides it.
export function Group({ header, footer, children, className }) {
  return (
    <section className={className}>
      {header && <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-muted-foreground">{header}</h2>}
      <div className="overflow-hidden rounded-xl bg-card [&>*:first-child>[data-sep]]:border-t-0">{children}</div>
      {footer && <div className="px-4 pt-1.5 text-[13px] leading-snug text-muted-foreground">{footer}</div>}
    </section>
  );
}

export function Cell({ children, className }) {
  return (
    <div className="pl-4">
      <div data-sep className={cn('border-t border-separator py-3 pr-4', className)}>{children}</div>
    </div>
  );
}

export function Row({ icon, iconColor, leading, title, subtitle, detail, detailClassName, chevron, onClick, wrap, children, className, titleClassName }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick}
      className={cn('flex w-full items-center gap-3 pl-4 text-left', onClick && 'transition-colors active:bg-muted', className)}>
      {icon && <IconTile icon={icon} color={iconColor} />}
      {leading}
      <div data-sep className="flex min-h-11 min-w-0 flex-1 items-center gap-3 border-t border-separator py-2.5 pr-4">
        <div className="min-w-0 flex-1">
          <div className={cn('text-[17px] leading-snug', !wrap && 'truncate', titleClassName)}>{title}</div>
          {subtitle && <div className={cn('mt-0.5 text-[13px] leading-snug text-muted-foreground', !wrap && 'truncate')}>{subtitle}</div>}
        </div>
        {detail != null && <div className={cn('shrink-0 text-[17px] tabular-nums text-muted-foreground', detailClassName)}>{detail}</div>}
        {children}
        {chevron && <ChevronRight className="-mr-1 size-5 shrink-0 text-muted-foreground/60" />}
      </div>
    </Comp>
  );
}

export function ButtonRow({ children, onClick, destructive, center, disabled, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center pl-4 text-left transition-colors active:bg-muted disabled:opacity-40">
      <div data-sep className={cn('flex min-h-11 flex-1 items-center gap-2 border-t border-separator py-2.5 pr-4 text-[17px]',
        destructive ? 'text-destructive' : 'text-primary', center && 'justify-center')}>
        {Icon && <Icon className="size-5" />}
        {children}
      </div>
    </button>
  );
}

export const TextField = forwardRef(function TextField({ label, multiline, align, className, ...props }, ref) {
  const Comp = multiline ? 'textarea' : 'input';
  return (
    <label className="flex w-full items-center pl-4">
      <div data-sep className={cn('flex min-h-11 flex-1 gap-3 border-t border-separator pr-4', multiline ? 'items-start' : 'items-center')}>
        {label && <span className={cn('shrink-0 text-[17px]', multiline && 'pt-2.5')}>{label}</span>}
        <Comp ref={ref} rows={multiline ? 3 : undefined}
          className={cn('min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70',
            multiline ? 'resize-none py-2.5' : 'h-11', align === 'right' && 'text-right', className)}
          {...props} />
      </div>
    </label>
  );
});

export function SelectRow({ label, value, onChange, options }) {
  const current = options.find(o => o.value === value);
  return (
    <label className="relative flex w-full items-center pl-4 active:bg-muted">
      <div data-sep className="flex min-h-11 flex-1 items-center gap-3 border-t border-separator pr-4">
        <span className="flex-1 text-[17px]">{label}</span>
        <span className="text-[17px] text-muted-foreground">{current?.label}</span>
        <ChevronsUpDown className="-ml-1.5 size-4 text-muted-foreground" />
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function DateRow({ label, value, onChange }) {
  return (
    <label className="flex w-full items-center pl-4">
      <div data-sep className="flex min-h-11 flex-1 items-center gap-3 border-t border-separator pr-4">
        <span className="flex-1 text-[17px]">{label}</span>
        <input type="date" value={value} onChange={e => onChange(e.target.value)}
          className="rounded-md bg-segment px-2.5 py-1 text-[17px] text-foreground outline-none" />
      </div>
    </label>
  );
}

export function Switch({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-success' : 'bg-segment')}>
      <span className={cn('absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow-md transition-transform duration-200', checked && 'translate-x-5')} />
    </button>
  );
}

// ─── Controls ───────────────────────────────────────────────────────────────
export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn('flex rounded-[9px] bg-segment p-0.5', className)}>
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn('h-8 min-w-0 flex-1 truncate rounded-[7px] px-2 text-[13px] font-medium transition-all',
            value === o.id ? 'bg-segment-selected shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]' : 'text-foreground/80')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0 }) {
  return (
    <div className="flex h-8 shrink-0 items-center rounded-lg bg-segment">
      <button type="button" aria-label="Menos" disabled={value <= min} onClick={() => onChange(value - 1)}
        className="flex h-full w-11 items-center justify-center active:opacity-50 disabled:opacity-30">
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span className="h-4 w-px bg-separator" />
      <button type="button" aria-label="Más" onClick={() => onChange(value + 1)}
        className="flex h-full w-11 items-center justify-center active:opacity-50">
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function BigButton({ variant = 'primary', className, ...props }) {
  return (
    <button className={cn('flex h-[50px] w-full items-center justify-center gap-2 rounded-xl px-4 text-[17px] font-semibold transition-opacity active:opacity-70 disabled:opacity-40 [&_svg]:size-5',
      variant === 'primary' && 'bg-primary text-primary-foreground',
      variant === 'tinted' && 'bg-primary/12 text-primary',
      variant === 'destructive' && 'bg-destructive/12 text-destructive',
      className)} {...props} />
  );
}

export function AmountField({ value, onChange, autoFocus }) {
  const len = Math.max(String(value || '').length, 1);
  return (
    <label className="flex items-baseline justify-center gap-1 py-3">
      <span className="text-[34px] font-semibold text-muted-foreground">₡</span>
      <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" autoFocus={autoFocus}
        value={value} onChange={e => onChange(e.target.value)} style={{ width: `${len + 0.6}ch` }}
        className="min-w-[2ch] max-w-full bg-transparent text-[52px] font-bold tabular-nums tracking-tight outline-none placeholder:text-muted-foreground/40" />
    </label>
  );
}

export function SearchField({ value, onChange, placeholder = 'Buscar' }) {
  return (
    <label className="flex h-9 items-center gap-1.5 rounded-[10px] bg-segment px-2 text-muted-foreground">
      <Search className="size-[18px] shrink-0" />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[17px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Borrar" className="flex size-5 items-center justify-center rounded-full bg-muted-foreground/50 text-background">
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
    </label>
  );
}

// ─── Visual bits ────────────────────────────────────────────────────────────
export function IconTile({ icon: Icon, color = '#8e8e93', size = 29 }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[7px] text-white" style={{ backgroundColor: color, width: size, height: size }}>
      <Icon style={{ width: size * 0.62, height: size * 0.62 }} />
    </span>
  );
}

export function FlavorTile({ flavor, size = 36 }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-[9px]"
      style={{ backgroundColor: `${flavor.color}26`, width: size, height: size, fontSize: size * 0.5 }}>
      {flavor.image ? <img src={flavor.image} alt="" className="size-full object-cover" /> : flavor.emoji}
    </span>
  );
}

const AVATAR_COLORS = ['#007aff', '#ff9500', '#af52de', '#ff2d55', '#30b0c7', '#5856d6'];
export function Avatar({ name = '', size = 36 }) {
  const color = AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ background: `linear-gradient(180deg, ${color}cc, ${color})`, width: size, height: size, fontSize: size * 0.42 }}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

const STATUS_COLOR = {
  pendiente: 'text-status-pendiente bg-status-pendiente/15',
  preparando: 'text-status-preparando bg-status-preparando/15',
  entregado: 'text-status-entregado bg-status-entregado/15',
  pagado: 'text-status-pagado bg-status-pagado/15',
  cancelado: 'text-status-cancelado bg-status-cancelado/15',
};
export function StatusPill({ status, className }) {
  const s = statusOf(status);
  return <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-semibold', STATUS_COLOR[s.id], className)}>{s.label}</span>;
}
export const statusDotClass = {
  pendiente: 'bg-status-pendiente', preparando: 'bg-status-preparando', entregado: 'bg-status-entregado',
  pagado: 'bg-status-pagado', cancelado: 'bg-status-cancelado',
};

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 size-12 text-muted-foreground/50" strokeWidth={1.5} />}
      <div className="text-[20px] font-semibold">{title}</div>
      {children && <p className="mt-1 max-w-xs text-[15px] text-muted-foreground">{children}</p>}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}

// ─── Sheets ─────────────────────────────────────────────────────────────────
// A modal sheet: slides up from the bottom on phones, a centered card on desktop.
// `cancel` and `confirm` are the nav-bar buttons ({ label, onClick, form, disabled }).
export function ModalSheet({ open, onOpenChange, title, cancel, confirm, children }) {
  const isMobile = useIsMobile();
  const close = () => onOpenChange(false);
  const left = cancel === undefined ? { label: 'Cancelar', onClick: close } : cancel;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content aria-describedby={undefined}
          className={cn('fixed z-50 flex flex-col bg-sheet text-foreground shadow-2xl outline-none [--card:var(--card-elevated)]',
            isMobile
              ? 'inset-x-0 bottom-0 max-h-[94svh] rounded-t-[14px] duration-300 ease-out data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom'
              : 'left-1/2 top-1/2 max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95')}>
          {isMobile && <div className="absolute left-1/2 top-1.5 h-[5px] w-9 -translate-x-1/2 rounded-full bg-muted-foreground/40" />}
          <div className="relative flex h-14 shrink-0 items-center justify-between px-4">
            {left ? <button type="button" onClick={left.onClick} className="text-[17px] text-primary active:opacity-50">{left.label}</button> : <span />}
            <DialogPrimitive.Title className="absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate text-[17px] font-semibold">{title}</DialogPrimitive.Title>
            {confirm ? (
              <button type={confirm.form ? 'submit' : 'button'} form={confirm.form} onClick={confirm.onClick} disabled={confirm.disabled}
                className="text-[17px] font-semibold text-primary active:opacity-50 disabled:opacity-30">
                {confirm.label}
              </button>
            ) : <span />}
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-1">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Keeps the last non-null value so a sheet's content stays put while it animates closed.
export function useSticky(value) {
  const [kept, setKept] = useState(value);
  useEffect(() => { if (value) setKept(value); }, [value]);
  return value || kept;
}
