'use client';

import { useEffect, useState } from 'react';
import { IconSun, IconMoon } from '@/lib/icons';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-theme');
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dashboard-theme', next);
  };

  return (
    <button id="theme-toggle" className="theme-toggle" onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
    </button>
  );
}
