import { ReactNode, useState } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Clock,
  DollarSign,
  Truck,
  ShoppingBag,
  PieChart,
  Database,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveShift } from '../../hooks/useShifts';
import { Button } from '../ui/Button';
import { OpenShiftModal } from '../shift/OpenShiftModal';
import { CloseShiftModal } from '../shift/CloseShiftModal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { format } from 'date-fns';

interface MainLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MainLayout({ children, activeTab, onTabChange }: MainLayoutProps) {
  const { profile, signOut } = useAuth();
  const { formatCurrency } = useCurrency();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const { data: activeShift } = useActiveShift();

  const navigation = [
    { id: 'register', name: 'Register', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
    { id: 'products', name: 'Products', icon: Package, roles: ['admin', 'manager'] },
    { id: 'inventory', name: 'Inventory', icon: Package, roles: ['admin', 'manager'] },
    { id: 'valuation', name: 'Valuation', icon: PieChart, roles: ['admin', 'manager'] },
    { id: 'suppliers', name: 'Suppliers', icon: Truck, roles: ['admin', 'manager'] },
    { id: 'purchase-orders', name: 'Purchase Orders', icon: ShoppingBag, roles: ['admin', 'manager'] },
    { id: 'customers', name: 'Customers', icon: Users, roles: ['admin', 'manager', 'cashier'] },
    { id: 'users', name: 'Users', icon: Users, roles: ['admin'] },
    { id: 'reports', name: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
    { id: 'data-management', name: 'Data Management', icon: Database, roles: ['admin'] },
    { id: 'settings', name: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const userRole = profile?.role || 'cashier';

  console.log('🔍 MainLayout Debug Info:');
  console.log('- Profile:', profile);
  console.log('- User Role:', userRole);
  console.log('- Is Admin:', profile?.role === 'admin');
  console.log('- Profile Role (raw):', profile?.role);

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(userRole)
  );

  console.log('- Available Navigation Items:', filteredNavigation.map(n => n.name));
  console.log('- Total items shown:', filteredNavigation.length);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-20 lg:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm flex items-center justify-between px-4 z-10">
        <h1 className="text-lg font-bold text-gray-900 py-2">Teefoods and Grainhub</h1>
        <div className="flex items-center gap-2">
          {activeShift && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>Active</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30 w-72 lg:w-72 bg-white border-r border-gray-200 shadow-xl transition-transform duration-300 flex flex-col`}
      >
        <div className="h-auto flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <h1 className="text-xl font-bold text-white leading-relaxed">
            Teefoods and Grainhub
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {activeShift && (
            <div className="mb-4 mx-1 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-emerald-900">Active Shift</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-emerald-700">
                <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                  <span className="font-medium">Started:</span>
                  <span className="font-bold">{format(new Date(activeShift.start_time), 'hh:mm a')}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                  <span className="font-medium">Sales:</span>
                  <span className="font-bold">{formatCurrency(activeShift.total_sales)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                  <span className="font-medium">Transactions:</span>
                  <span className="font-bold">{activeShift.transaction_count}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="success"
                onClick={() => setCloseShiftModalOpen(true)}
                className="w-full mt-3"
              >
                Close Shift
              </Button>
            </div>
          )}

          {!activeShift && (
            <div className="mb-4 mx-1 p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-amber-900">No Active Shift</span>
              </div>
              <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                Open a shift to start processing sales
              </p>
              <Button
                size="sm"
                onClick={() => setOpenShiftModalOpen(true)}
                className="w-full"
              >
                Open Shift
              </Button>
            </div>
          )}

          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200 scale-[1.02]'
                    : 'text-gray-700 hover:bg-gray-100 hover:scale-[1.01]'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="ml-3">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white">
          {profile && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm font-bold text-gray-900">{profile.full_name}</p>
              <p className="text-xs text-gray-600 capitalize font-medium mt-0.5">{profile.role}</p>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={signOut}
            className="w-full justify-start hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3">Sign Out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pt-16 lg:pt-0 bg-gradient-to-br from-gray-50 to-gray-100">
        {children}
      </main>

      <OpenShiftModal
        isOpen={openShiftModalOpen}
        onClose={() => setOpenShiftModalOpen(false)}
      />

      {activeShift && (
        <CloseShiftModal
          isOpen={closeShiftModalOpen}
          onClose={() => setCloseShiftModalOpen(false)}
          shift={activeShift}
        />
      )}
    </div>
  );
}
