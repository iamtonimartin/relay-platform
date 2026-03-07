import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 mr-2 text-slate-600 hover:bg-slate-50 rounded-lg lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1">
            {/* Page title will be injected here if needed */}
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <button
              onClick={() => navigate('/docs')}
              className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Docs
            </button>
            <div className="hidden sm:block h-4 w-px bg-slate-200"></div>
            <button 
              onClick={() => navigate('/assistants?create=true')}
              className="px-3 lg:px-4 py-2 bg-teal-600 text-white rounded-lg text-xs lg:text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm whitespace-nowrap"
            >
              New Assistant
            </button>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
