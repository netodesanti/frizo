import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { Route } from 'lucide-react';
import { navigate } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { TABS } from '@/components/tab-bar';
import logo from '@/assets/frizo-logo.svg';

// Desktop navigation; phones use the tab bar.
export function AppSidebar({ tab, route, totalStock }) {
	const items = [...TABS.slice(0, 2), { key: 'orders/routes', label: 'Rutas', icon: Route }, ...TABS.slice(2)];
	const isActive = (key) => key.includes('/') ? route.startsWith(key) : tab === key && !items.some(i => i.key.includes('/') && route.startsWith(i.key));

	return (
		<Sidebar collapsible="none" className="h-svh w-64 bg-transparent">
			<SidebarHeader className="px-6 pb-4 pt-7">
				<img src={logo} alt="Frizo" className="h-7 w-auto self-start object-contain" />
			</SidebarHeader>
			<SidebarContent className="px-4">
				<nav className="space-y-1">
					{items.map(item => {
						const active = isActive(item.key);
						return (
							<button key={item.key} onClick={() => navigate(item.key)}
								className={cn('flex h-12 w-full items-center gap-3 rounded-full px-4 text-[15px] font-semibold transition-colors',
									active ? 'bg-primary text-white shadow-float' : 'text-foreground/70 hover:bg-white/70')}>
								<item.icon className={cn('size-5', active && 'text-brand-lime')} />
								{item.label}
							</button>
						);
					})}
				</nav>
			</SidebarContent>
			<SidebarFooter className="p-4">
				<div className="grain overflow-hidden rounded-[24px] bg-brand-lime p-4 text-brand-green">
					<div className="text-[13px] font-semibold opacity-75">En stock</div>
					<div className="font-display text-[30px] font-bold leading-tight tabular-nums">{totalStock} <span className="text-[15px]">bolsas</span></div>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
