import { LayoutDashboard, ClipboardList, Plus, Receipt, Menu } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const TABS = [
	{ key: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
	{ key: 'orders', label: 'Pedidos', icon: ClipboardList },
	{ key: 'neworder', label: 'Nuevo', icon: Plus, primary: true },
	{ key: 'costs', label: 'Gastos', icon: Receipt },
];

// Phone-only tab bar. "Más" opens the sidebar drawer for the remaining pages.
export function BottomNav({ page, onNavigate }) {
	const { setOpenMobile } = useSidebar();
	const inMore = !TABS.some(t => t.key === page);

	const tabClass = (active) => cn(
		'flex flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium transition-colors',
		active ? 'text-foreground' : 'text-muted-foreground',
	);

	return (
		<nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
			<div className="grid h-16 grid-cols-5">
				{TABS.map(t => t.primary ? (
					<button key={t.key} onClick={() => onNavigate(t.key)} className="flex items-center justify-center" aria-label="Nuevo pedido">
						<span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
							<t.icon className="size-6" />
						</span>
					</button>
				) : (
					<button key={t.key} onClick={() => onNavigate(t.key)} className={tabClass(page === t.key)}>
						<t.icon className="size-5" />
						{t.label}
					</button>
				))}
				<button onClick={() => setOpenMobile(true)} className={tabClass(inMore)}>
					<Menu className="size-5" />
					Más
				</button>
			</div>
		</nav>
	);
}
