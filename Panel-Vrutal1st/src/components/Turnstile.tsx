import { useEffect, useRef } from 'react';

// Excepción aprobada a "sin scripts de terceros": el widget de Cloudflare Turnstile.
// La verificación real la hace Supabase Auth en el servidor con la clave secreta.
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileRenderOptions {
  sitekey: string;
  theme: 'dark';
  language: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface TurnstileProps {
  siteKey: string;
  /** Cambia este número para pedir un token nuevo (los tokens son de un solo uso). */
  resetSignal: number;
  onToken: (token: string | null) => void;
  onLoadError: () => void;
}

export function Turnstile({ siteKey, resetSignal, onToken, onLoadError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Refs para que el widget no se vuelva a montar si el padre cambia los callbacks.
  const onTokenRef = useRef(onToken);
  const onLoadErrorRef = useRef(onLoadError);
  useEffect(() => {
    onTokenRef.current = onToken;
    onLoadErrorRef.current = onLoadError;
  });

  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then(
      (api) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          language: 'es',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      },
      () => {
        if (!cancelled) onLoadErrorRef.current();
      },
    );
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal === 0 || !widgetIdRef.current || !window.turnstile) return;
    onTokenRef.current(null);
    window.turnstile.reset(widgetIdRef.current);
  }, [resetSignal]);

  return <div ref={containerRef} className="auth-card__captcha" />;
}
