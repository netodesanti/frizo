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

// Phone-only floating pill. The dark circle springs to the active tab.
export function TabBar({ tab }) {
	const index = Math.max(0, TABS.findIndex(t => t.key === tab));
	return (
		<nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-5 pb-[calc(env(safe-area-inset-bottom)+10px)] md:hidden">
			<div className="pointer-events-auto relative mx-auto flex h-[68px] max-w-sm items-center rounded-full bg-white/90 px-2 shadow-float backdrop-blur-xl">
				<span aria-hidden className="absolute inset-y-0 left-2 flex w-[calc((100%-1rem)/5)] items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)]"
					style={{ transform: `translateX(${index * 100}%)` }}>
					<span className="size-[52px] rounded-full bg-primary shadow-[0_6px_16px_rgb(25_75_20/0.35)]" />
				</span>
				{TABS.map(t => {
					const active = tab === t.key;
					return (
						<button key={t.key} onClick={() => navigate(t.key)} aria-label={t.label} aria-current={active ? 'page' : undefined}
							className="relative flex h-full flex-1 items-center justify-center active:scale-90 transition-transform">
							<t.icon className={cn('size-6 transition-colors duration-300', active ? 'text-brand-lime' : 'text-foreground/45')} strokeWidth={active ? 2.4 : 2} />
						</button>
					);
				})}
			</div>
		</nav>
	);
}
