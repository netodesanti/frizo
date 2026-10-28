import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarGroup,
} from '@/components/ui/sidebar';
import { Route } from 'lucide-react';
import { navigate } from '@/lib/nav';
import { TABS } from '@/components/tab-bar';
import logo from '@/assets/frizo-logo.svg';

// Desktop navigation; phones use the tab bar.
export function AppSidebar({ tab, route, totalStock }) {
	const items = [...TABS.slice(0, 2), { key: 'orders/routes', label: 'Rutas', icon: Route }, ...TABS.slice(2)];
	const isActive = (key) => key.includes('/') ? route.startsWith(key) : tab === key && !items.some(i => i.key.includes('/') && route.startsWith(i.key));

	return (
		<Sidebar collapsible="none" className="h-svh w-60 border-r border-sidebar-border">
			<SidebarHeader className="px-4 pb-2 pt-5">
				<img src={logo} alt="Frizo" className="h-7 w-auto self-start object-contain dark:brightness-0 dark:invert" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu className="gap-0.5">
						{items.map(item => (
							<SidebarMenuItem key={item.key}>
								<SidebarMenuButton isActive={isActive(item.key)} onClick={() => navigate(item.key)}
									className="h-9 rounded-lg text-[15px] data-[active=true]:bg-primary/12 data-[active=true]:font-semibold data-[active=true]:text-primary">
									<item.icon className="size-[18px]" />
									<span>{item.label}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="px-4 pb-5">
				<div className="text-[13px] text-muted-foreground">En stock</div>
				<div className="text-[22px] font-bold tabular-nums">{totalStock} bolsas</div>
			</SidebarFooter>
		</Sidebar>
	);
}
