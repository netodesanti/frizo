import { cn } from '@/lib/utils';

function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-auto border border-border rounded-lg bg-card shadow-sm">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead className={cn('bg-secondary sticky top-0', className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableRow({ className, ...props }) {
  return <tr className={cn('border-b border-border transition-colors hover:bg-secondary/50', className)} {...props} />;
}

function TableHead({ className, ...props }) {
  return <th className={cn('h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border whitespace-nowrap', className)} {...props} />;
}

function TableCell({ className, ...props }) {
  return <td className={cn('px-3 py-2 align-middle', className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
