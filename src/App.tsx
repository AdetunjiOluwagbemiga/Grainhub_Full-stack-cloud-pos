import { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { queryClient } from './lib/queryClient';
import { LoginPage } from './components/auth/LoginPage';
import { MainLayout } from './components/layout/MainLayout';
import { Register } from './components/register/Register';
import { ProductsPage } from './components/products/ProductsPage';
import { InventoryPage } from './components/inventory/InventoryPage';
import { ValuationDashboard } from './components/valuation/ValuationDashboard';
import { SuppliersPage } from './components/suppliers/SuppliersPage';
import { PurchaseOrdersPage } from './components/procurement/PurchaseOrdersPage';
import { CustomersPage } from './components/customers/CustomersPage';
import { UsersPage } from './components/users/UsersPage';
import { ReportsPage } from './components/reports/ReportsPage';
import { DataManagementPage } from './components/admin/DataManagementPage';
import { SettingsPage } from './components/settings/SettingsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'register';
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'register':
        return <Register />;
      case 'products':
        return <ProductsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'valuation':
        return <ValuationDashboard />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'purchase-orders':
        return <PurchaseOrdersPage />;
      case 'customers':
        return <CustomersPage />;
      case 'users':
        return <UsersPage />;
      case 'reports':
        return <ReportsPage />;
      case 'data-management':
        return <DataManagementPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Register />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <AppContent />
          <Toaster position="top-right" />
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
