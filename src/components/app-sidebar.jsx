import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuBadge,
	SidebarRail,
	SidebarGroup,
	SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
	LayoutDashboard,
	PlusCircle,
	FileSpreadsheet,
	Package,
	ClipboardList,
	Route,
	Settings,
	Receipt,
	LogOut,
	ShoppingBag,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';
import logo from '@/assets/frizo-logo.svg';

const NAV_GROUPS = [
	{
		label: 'General',
		items: [{ key: 'dashboard', label: 'Inicio', icon: LayoutDashboard }],
	},
	{
		label: 'Pedidos',
		items: [
			{ key: 'neworder', label: 'Nuevo Pedido', icon: PlusCircle },
			{ key: 'bulk', label: 'Carga Masiva', icon: FileSpreadsheet },
			{ key: 'orders', label: 'Pedidos', icon: ClipboardList },
		],
	},
	{
		label: 'Operaciones',
		items: [
			{ key: 'products', label: 'Productos', icon: ShoppingBag },
			{ key: 'inventory', label: 'Inventario', icon: Package },
			{ key: 'routes', label: 'Rutas', icon: Route },
		],
	},
	{
		label: 'Finanzas',
		items: [{ key: 'costs', label: 'Gastos', icon: Receipt }],
	},
	{
		label: 'Ajustes',
		items: [{ key: 'settings', label: 'Configuracion', icon: Settings }],
	},
];

export function AppSidebar({ page, onNavigate, totalStock, ...props }) {
	return (
		<Sidebar
			className="border-r-0"
			{...props}
		>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							className="pointer-events-none h-auto py-3"
						>
							<div className="flex items-center justify-start w-full">
								<img
									src={logo}
									alt="Frizo"
									className="h-8 w-auto object-contain group-data-[collapsible=icon]:h-6"
								/>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{NAV_GROUPS.map(group => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarMenu>
							{group.items.map(item => (
								<SidebarMenuItem key={item.key}>
									<SidebarMenuButton
										isActive={page === item.key}
										onClick={() => onNavigate(item.key)}
										tooltip={item.label}
									>
										<item.icon />
										<span>{item.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton className="pointer-events-none">
							<Package className="text-primary" />
							<span className="text-xs text-muted-foreground">En stock</span>
							<SidebarMenuBadge className="font-heading font-extrabold text-primary">
								{totalStock}
							</SidebarMenuBadge>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton onClick={() => signOut(auth)} tooltip="Cerrar sesión">
							<LogOut />
							<span>Cerrar sesión</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
