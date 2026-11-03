import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

declare const __APP_BUILD_ID__: string;

const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';
const CHECK_INTERVAL_MS = 45 * 1000; // Verifica a cada 45 segundos

export default function UpdateNotifier() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkVersion = useCallback(async () => {
    // Em modo de desenvolvimento local (vite dev), não exibe alerta de build
    if (import.meta.env.DEV || !CURRENT_BUILD_ID) return;

    try {
      const timestamp = Date.now();
      const res = await fetch(`/version.json?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data?.buildId && data.buildId !== CURRENT_BUILD_ID) {
            setHasUpdate(true);
            return;
          }
        } else {
          // Fallback caso o servidor retorne o index.html
          const html = await res.text();
          const match = html.match(/<meta\s+name="app-build-id"\s+content="([^"]+)"/i);
          if (match?.[1] && match[1] !== CURRENT_BUILD_ID) {
            setHasUpdate(true);
            return;
          }
        }
      }
    } catch {
      // Ignora falhas temporárias de rede
    }
  }, []);

  useEffect(() => {
    // Limpa o parâmetro _v da URL após recarregar a nova versão
    const url = new URL(window.location.href);
    if (url.searchParams.has('_v')) {
      url.searchParams.delete('_v');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }

    checkVersion();

    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    const handlePreloadError = () => {
      setHasUpdate(true);
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('vite:preloadError', handlePreloadError);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('vite:preloadError', handlePreloadError);
    };
  }, [checkVersion]);

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {
      // Prossegue mesmo se limpeza de cache falhar
    }

    // Força o carregamento da versão mais recente ignorando cache
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  };

  if (!hasUpdate) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        border: '1px solid rgba(20, 184, 166, 0.45)',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        maxWidth: '420px',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'rgba(20, 184, 166, 0.15)',
          color: '#14b8a6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={20} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
          Nova versão disponível!
        </div>
        <div style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.4 }}>
          Uma atualização do sistema foi publicada. Atualize para usar a versão mais recente.
        </div>
      </div>

      <button
        onClick={handleUpdateNow}
        disabled={isUpdating}
        style={{
          background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isUpdating ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
        }}
      >
        <RefreshCw size={14} className={isUpdating ? 'spin' : undefined} />
        <span>{isUpdating ? 'Atualizando...' : 'Atualizar'}</span>
      </button>
    </div>
  );
}
