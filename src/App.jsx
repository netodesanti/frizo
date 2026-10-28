import { useStore, StoreProvider } from '@/lib/store';
import { useRoute } from '@/lib/nav';
import { sumQty } from '@/lib/data';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { TabBar } from '@/components/tab-bar';
import { DashboardPage } from '@/pages/dashboard';
import { OrdersPage, NewOrderPage } from '@/pages/orders';
import { BulkUploadPage } from '@/pages/bulk-upload';
import { RoutesPage } from '@/pages/routes';
import { CostsPage } from '@/pages/costs';
import { ProductsPage, ProductPage } from '@/pages/products';
import { SettingsPage, PartnersPage, AddressesPage, RecalcPage, HistoryPage, PeriodPage } from '@/pages/settings';
import logo from '@/assets/frizo-logo.svg';

function Screens({ route }) {
  const [tab, sub, id] = route.split('/');
  switch (tab) {
    case 'orders':
      if (sub === 'new') return <NewOrderPage />;
      if (sub === 'bulk') return <BulkUploadPage />;
      if (sub === 'routes') return <RoutesPage />;
      return <OrdersPage />;
    case 'costs': return <CostsPage sub={sub} />;
    case 'products': return sub ? <ProductPage id={sub} /> : <ProductsPage />;
    case 'settings':
      if (sub === 'partners') return <PartnersPage />;
      if (sub === 'addresses') return <AddressesPage />;
      if (sub === 'inventory') return <RecalcPage />;
      if (sub === 'history') return id ? <PeriodPage id={id} /> : <HistoryPage />;
      return <SettingsPage />;
    default: return <DashboardPage />;
  }
}

function Shell() {
  const route = useRoute();
  const { loading, stock } = useStore();
  const tab = route.split('/')[0];

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <img src={logo} alt="Frizo" className="h-10 w-auto animate-pulse" />
      </div>
    );
  }

  return (
    <SidebarProvider className="min-h-svh">
      <div className="sticky top-0 hidden h-svh shrink-0 md:block">
        <AppSidebar tab={tab} route={route} totalStock={sumQty(stock)} />
      </div>
      <div className="min-w-0 flex-1 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-12">
        <Screens route={route} />
      </div>
      <TabBar tab={tab} />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
