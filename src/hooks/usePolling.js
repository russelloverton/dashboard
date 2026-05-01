'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic polling hook.
 * Fetches data from a URL immediately, then every `interval` ms.
 * 
 * @param {string} url — API endpoint to fetch
 * @param {number} interval — polling interval in milliseconds (0 = no polling)
 * @returns {{ data, error, loading, refetch }}
 */
export function usePolling(url, interval = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (mountedRef.current) {
        setData(json);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchData();

    let timer;
    if (interval > 0) {
      timer = setInterval(fetchData, interval);
    }

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [fetchData, interval]);

  return { data, error, loading, refetch: fetchData };
}
