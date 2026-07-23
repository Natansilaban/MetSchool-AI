'use client';

import { createContext, useContext, useState } from 'react';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobileSidebar = () => setMobileOpen(prev => !prev);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, toggleMobileSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return {
      mobileOpen: false,
      setMobileOpen: () => {},
      toggleMobileSidebar: () => {},
    };
  }
  return context;
}
