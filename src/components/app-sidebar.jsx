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
} from 'lucide-react';
import logo from '@/assets/frizo-logo.svg';

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { key: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Pedidos',
    items: [
      { key: 'neworder', label: 'Nuevo Pedido',   icon: PlusCircle },
      { key: 'bulk',     label: 'Carga Masiva',   icon: FileSpreadsheet },
      { key: 'orders',   label: 'Pedidos',        icon: ClipboardList },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { key: 'inventory', label: 'Inventario', icon: Package },
      { key: 'routes',    label: 'Rutas',      icon: Route },
    ],
  },
  {
    label: 'Ajustes',
    items: [
      { key: 'settings', label: 'Configuracion', icon: Settings },
    ],
  },
];

export function AppSidebar({ page, onNavigate, totalStock, ...props }) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none h-auto py-3">
              <div className="flex items-center justify-center w-full">
                <img src={logo} alt="Frizo" className="h-8 w-auto object-contain group-data-[collapsible=icon]:h-6" />
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
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
