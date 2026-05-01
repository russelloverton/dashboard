'use client';

import { useState, useRef, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { IconSend } from '@/lib/icons';

export default function AILauncher() {
  const config = useConfig();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const externalUrl = config?.external_urls?.open_webui || 'https://llm.squidball.xyz';
  const qp = config?.external_urls?.open_webui_query_param || 'q';

  useEffect(() => {
    const shortcut = config?.keyboard_shortcuts?.focus_ai_launcher || 'l';
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === shortcut) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [config]);

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    window.open(q ? `${externalUrl}/?${qp}=${encodeURIComponent(q)}` : externalUrl, '_blank');
    setQuery('');
  };

  return (
    <div className="panel panel-compact">
      <form className="ai-bar" onSubmit={submit}>
        <input ref={inputRef} type="text" className="ai-input" placeholder="Ask AI…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
        <button type="submit" className="ai-go"><IconSend size={12} /></button>
      </form>
    </div>
  );
}
