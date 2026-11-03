import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

export const CandidateLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full">
      <Navbar onMobileMenuToggle={() => setMobileMenuOpen(true)} />
      <div className="app-layout flex-1 flex w-full min-w-0">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="main-content flex-1 min-w-0 w-full overflow-y-auto">
          <div className="dashboard-container w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
