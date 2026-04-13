import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary',
        verde: 'bg-verde/12 text-verde',
        antioxidante: 'bg-antioxidante/12 text-antioxidante',
        boost: 'bg-boost/12 text-boost',
        pendiente: 'bg-status-pendiente/12 text-status-pendiente',
        preparando: 'bg-status-preparando/12 text-status-preparando',
        entregado: 'bg-status-entregado/12 text-status-entregado',
        pagado: 'bg-status-pagado/15 text-status-pagado',
        cancelado: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
