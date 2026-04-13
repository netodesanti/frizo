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
} from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Inicio',        icon: LayoutDashboard },
  { key: 'neworder',   label: 'Nuevo Pedido',   icon: PlusCircle },
  { key: 'bulk',       label: 'Carga Masiva',   icon: FileSpreadsheet },
  { key: 'inventory',  label: 'Inventario',     icon: Package },
  { key: 'orders',     label: 'Pedidos',        icon: ClipboardList },
];

export function AppSidebar({ page, onNavigate, totalStock, ...props }) {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-heading font-extrabold text-sm">
                F
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="font-heading font-extrabold text-base truncate">Frizo</span>
                <span className="text-xs text-muted-foreground truncate">Bolsas de Smoothie</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(item => (
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
