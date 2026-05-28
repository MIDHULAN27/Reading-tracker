import React, { createContext, useContext } from 'react';
import { useSidebarStore } from '../store/useSidebarStore';

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
  const sidebarState = useSidebarStore();

  return (
    <SidebarContext.Provider value={sidebarState}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
