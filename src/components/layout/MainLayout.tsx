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
    { id: 'settings', name: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(profile?.role || 'cashier')
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            Cloud POS
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {activeShift && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm">
              <Clock className="w-3 h-3" />
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
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30 w-72 lg:w-72 bg-white/95 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 flex flex-col shadow-xl lg:shadow-none`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200/50 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Cloud POS</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {activeShift && (
            <div className="mb-4 mx-1 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-green-900">Active Shift</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="text-green-700 font-medium">Started:</span>
                  <span className="font-bold text-green-900">{format(new Date(activeShift.start_time), 'hh:mm a')}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="text-green-700 font-medium">Sales:</span>
                  <span className="font-bold text-green-900">{formatCurrency(activeShift.total_sales)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                  <span className="text-green-700 font-medium">Transactions:</span>
                  <span className="font-bold text-green-900">{activeShift.transaction_count}</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setCloseShiftModalOpen(true)}
                className="w-full mt-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md transition-all duration-200 transform hover:scale-[1.02]"
              >
                Close Shift
              </Button>
            </div>
          )}

          {!activeShift && (
            <div className="mb-4 mx-1 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
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
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md transition-all duration-200 transform hover:scale-[1.02]"
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
                className={`w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 transform scale-[1.02]'
                    : 'text-gray-700 hover:bg-gray-100 hover:transform hover:scale-[1.02]'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isActive ? 'transform scale-110' : 'group-hover:scale-110'}`} />
                <span className="ml-3 font-semibold">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200/50 bg-gradient-to-br from-gray-50 to-white">
          {profile && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-gray-200/50 shadow-sm">
              <p className="text-sm font-bold text-gray-900">{profile.full_name}</p>
              <p className="text-xs text-gray-500 capitalize font-medium mt-0.5">{profile.role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start hover:bg-red-50 hover:text-red-600 transition-all duration-200 font-semibold"
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3">Sign Out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        <div className="p-6">
          {children}
        </div>
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
