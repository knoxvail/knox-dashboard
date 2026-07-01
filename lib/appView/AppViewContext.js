'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

const AppViewContext = createContext(null);

export function AppViewProvider({ children }) {
  const [view, setView] = useState('map'); // 'map' | 'database' | 'settings'
  const restoredRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('crestView');
    if (saved === 'map' || saved === 'database') setView(saved);
    restoredRef.current = true;
  }, []);

  useEffect(() => {
    // Don't persist until after the initial restore (avoids overwriting saved value)
    if (!restoredRef.current) return;
    if (view === 'map' || view === 'database') localStorage.setItem('crestView', view);
  }, [view]);

  return <AppViewContext.Provider value={{ view, setView }}>{children}</AppViewContext.Provider>;
}

export function useAppView() {
  const ctx = useContext(AppViewContext);
  return ctx || { view: 'map', setView: () => {} };
}
