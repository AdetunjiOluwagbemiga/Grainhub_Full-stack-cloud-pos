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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveShift } from '../../hooks/useShifts';
import { Button } from '../ui/Button';
import { OpenShiftModal } from '../shift/OpenShiftModal';
import { CloseShiftModal } from '../shift/CloseShiftModal';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';

interface MainLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MainLayout({ children, activeTab, onTabChange }: MainLayoutProps) {
  const { profile, signOut } = useAuth();
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
    { id: 'reports', name: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
    { id: 'settings', name: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(profile?.role || 'cashier')
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-10">
        <h1 className="text-xl font-bold text-gray-900">Cloud POS</h1>
        <div className="flex items-center gap-2">
          {activeShift && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
              <Clock className="w-3 h-3" />
              <span>Active</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30 w-64 lg:w-64 bg-white border-r border-gray-200 transition-transform duration-300 flex flex-col`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Cloud POS</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {activeShift && (
            <div className="mb-4 mx-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-900">Active Shift</span>
                </div>
              </div>
              <div className="space-y-1 text-xs text-green-700">
                <div className="flex justify-between">
                  <span>Started:</span>
                  <span className="font-medium">{format(new Date(activeShift.start_time), 'hh:mm a')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sales:</span>
                  <span className="font-medium">{formatCurrency(activeShift.total_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transactions:</span>
                  <span className="font-medium">{activeShift.transaction_count}</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setCloseShiftModalOpen(true)}
                className="w-full mt-3 bg-green-600 hover:bg-green-700"
              >
                Close Shift
              </Button>
            </div>
          )}

          {!activeShift && (
            <div className="mb-4 mx-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">No Active Shift</span>
              </div>
              <p className="text-xs text-amber-700 mb-3">
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
                className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="ml-3">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {profile && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start"
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3">Sign Out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
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
