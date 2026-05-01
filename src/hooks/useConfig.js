'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext(null);

/**
 * Provider that fetches config once and provides it to all children.
 */
export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(setConfig)
      .catch(err => {
        console.error('[config] Failed to load client config:', err);
        setConfig({});
      });
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * Hook to access the client-safe config.
 * Returns null while loading.
 */
export function useConfig() {
  return useContext(ConfigContext);
}
