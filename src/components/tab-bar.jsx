import { House, ClipboardList, Wallet, CupSoda, Settings } from 'lucide-react';
import { navigate } from '@/lib/nav';
import { cn } from '@/lib/utils';

export const TABS = [
	{ key: 'dashboard', label: 'Inicio', icon: House },
	{ key: 'orders', label: 'Pedidos', icon: ClipboardList },
	{ key: 'costs', label: 'Gastos', icon: Wallet },
	{ key: 'products', label: 'Productos', icon: CupSoda },
	{ key: 'settings', label: 'Ajustes', icon: Settings },
];

// Phone-only translucent tab bar, like UITabBar.
export function TabBar({ tab }) {
	return (
		<nav className="fixed inset-x-0 bottom-0 z-40 border-t border-separator/70 bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden">
			<div className="grid h-[50px] grid-cols-5">
				{TABS.map(t => (
					<button key={t.key} onClick={() => navigate(t.key)}
						className={cn('flex flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium',
							tab === t.key ? 'text-primary' : 'text-[#999] dark:text-[#8d8d93]')}>
						<t.icon className="size-6" strokeWidth={tab === t.key ? 2.25 : 1.75} />
						{t.label}
					</button>
				))}
			</div>
		</nav>
	);
}
