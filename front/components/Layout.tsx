import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  MapPin,
  Menu,
  X,
  LogOut,
  Bell,
  ChevronRight,
  Sparkles,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { User as UserType, City } from '../types';
import { api } from '../api';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../src/lib/utils';
import { navigationSections, getVisibleSections } from './navigation';
import BottomNav from './BottomNav';

interface LayoutProps {
  currentUser: UserType;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop collapse
  const [selectedCityId, setSelectedCityId] = useState<string>(currentUser.cityId);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setSelectedCityId(currentUser.cityId);
  }, [currentUser]);

  useEffect(() => {
    api.getCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  const currentCity = cities.find(c => c.id === selectedCityId) || cities[0] || { id: '0', name: 'Sem cidade', uf: '' };

  const visibleSections = getVisibleSections(navigationSections, currentUser);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const sidebarWidth = isCollapsed ? "w-24" : "w-60";

  return (
    <div className="h-[100dvh] w-full bg-[#f8fafc] flex overflow-hidden">
      {/* Overlay para mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" 
            onClick={() => setSidebarOpen(false)} 
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-100 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:translate-x-0 lg:static lg:h-full flex-shrink-0 flex flex-col",
          sidebarOpen ? "translate-x-0 w-60" : "-translate-x-full lg:translate-x-0",
          !sidebarOpen && sidebarWidth
        )}
      >
        {/* Logo Section */}
        <div className={cn(
          "h-14 flex items-center border-b border-slate-100 transition-all duration-300",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          <div className="flex items-center gap-2 overflow-hidden">
            <img src="/imgs/mfc_logo01.png" alt="MFC" className="w-6 h-6 object-contain shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-bold text-slate-900 tracking-tight whitespace-nowrap">
                MFC <span className="text-slate-400 font-medium">Gestão</span>
              </span>
            )}
          </div>
          {!isCollapsed && (
            <button
              className="lg:hidden p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 space-y-4 overflow-y-auto no-scrollbar py-3">
          {visibleSections.map((section) => {
            return (
              <div key={section.label} className="space-y-0.5">
                {!isCollapsed && (
                  <h3 className="px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    {section.label}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        title={isCollapsed ? item.name : ''}
                        className={cn(
                          "w-full flex items-center rounded-lg text-[13px] transition-colors duration-150 group relative",
                          isCollapsed ? "justify-center p-2" : "pl-3 pr-2.5 py-2 gap-2.5 font-medium",
                          active
                            ? "text-blue-600 bg-blue-50"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        )}
                      >
                        {!isCollapsed && (
                          <span
                            className={cn(
                              "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-blue-600 transition-opacity",
                              active ? "opacity-100" : "opacity-0"
                            )}
                          />
                        )}
                        <item.icon
                          className={cn(
                            "shrink-0 transition-colors duration-150",
                            isCollapsed ? "w-5 h-5" : "w-[17px] h-[17px]",
                            active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                          )}
                        />
                        {!isCollapsed && (
                          <span className="flex-1 text-left tracking-tight whitespace-nowrap truncate">{item.name}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {isCollapsed && <div className="h-px bg-slate-100 mx-3 my-3" />}
              </div>
            );
          })}
        </nav>

        {/* Desktop Collapse Toggle */}
        <div className="hidden lg:flex px-2.5 py-2 border-t border-slate-100">
           <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full py-1.5 flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-[11px] font-medium"
           >
              <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
                <ChevronRight size={14} />
              </motion.div>
              {!isCollapsed && "Recolher"}
           </button>
        </div>

        {/* User Card */}
        <div className={cn("border-t border-slate-100 flex items-center", isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5")}>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser.name.substring(0, 2).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-800 truncate leading-none mb-0.5">
                {currentUser.name.split(' ')[0]}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentUser.role.split('_').pop()}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Floating Navbar */}
        <header className="h-14 flex items-center justify-between gap-3 px-3 sm:px-5 flex-shrink-0 z-30 border-b border-slate-100 bg-white">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="lg:hidden p-2 bg-white hover:bg-slate-50 rounded-md transition-colors border border-slate-200"
              aria-label="Abrir menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4 text-slate-600" />
            </button>
            
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                {getTimeGreeting()}, <span className="text-blue-600">{currentUser.name.split(' ')[0]}</span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-md border border-slate-200/50">
                  <MapPin size={10} className="text-blue-500" />
                  {currentCity.name}
                </div>
                <span className="hidden sm:inline text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>
          </div>

        </header>
        
        {/* Page Content Scroll Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar pb-4">
          <div className="px-3 sm:px-0">
            <Outlet />
          </div>
        </main>

        <BottomNav currentUser={currentUser} onOpenMore={() => setSidebarOpen(true)} />
      </div>
    </div>
  );
};

export default Layout;
