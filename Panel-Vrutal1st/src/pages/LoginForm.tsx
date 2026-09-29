import { useState, type FormEvent } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Turnstile } from '../components/Turnstile';
import '../styles/pages/login.css';

type Mode = 'login' | 'forgot' | 'forgot-sent';

// Clave de sitio pública. Sin ella no se muestra captcha (Supabase lo exige igualmente si está activado).
const TURNSTILE_SITE_KEY: string | null = import.meta.env.VITE_TURNSTILE_SITE_KEY || null;

// Mensajes que no revelan si el correo existe.
function authErrorMessage(error: AuthError, fallback: string): string {
  if (error.code === 'captcha_failed') return 'La verificación anti-bots ha fallado. Inténtalo de nuevo.';
  if (error.status === 429) return 'Demasiados intentos. Espera unos minutos.';
  return fallback;
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const waitingCaptcha = TURNSTILE_SITE_KEY !== null && !captchaToken;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setCaptchaToken(null);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      setError(authErrorMessage(error, 'Correo o contraseña no válidos.'));
      setCaptchaReset((n) => n + 1); // el token ya se ha consumido
    }
    setSubmitting(false);
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
      captchaToken: captchaToken ?? undefined,
    });
    setSubmitting(false);
    setCaptchaReset((n) => n + 1);
    if (error && (error.code === 'captcha_failed' || error.status === 429)) {
      setError(authErrorMessage(error, ''));
      return;
    }
    // Cualquier otro caso: misma respuesta, exista o no la cuenta.
    setMode('forgot-sent');
  }

  const captcha = TURNSTILE_SITE_KEY !== null && (
    <Turnstile
      siteKey={TURNSTILE_SITE_KEY}
      resetSignal={captchaReset}
      onToken={setCaptchaToken}
      onLoadError={() => setCaptchaUnavailable(true)}
    />
  );

  const notices = (
    <>
      {captchaUnavailable && (
        <p className="notice notice--error" role="alert">
          No se ha podido cargar la verificación anti-bots. Revisa tu conexión o bloqueadores y recarga.
        </p>
      )}
      {import.meta.env.DEV && TURNSTILE_SITE_KEY === null && (
        <p className="notice notice--info">Desarrollo: captcha desactivado (falta VITE_TURNSTILE_SITE_KEY).</p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </>
  );

  const emailField = (id: string) => (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        Correo corporativo
      </label>
      <input
        id={id}
        className="text-input"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
    </div>
  );

  const logo = <img className="auth-card__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />;

  return (
    <div className="auth-screen">
      {mode === 'login' && (
        <form className="auth-card" onSubmit={handleLogin}>
          {logo}
          <h1 className="auth-card__title">Acceso al panel</h1>
          <p className="auth-card__subtitle">Vrutal1st · plano de control</p>

          {emailField('login-email')}

          <div className="form-field">
            <div className="form-field__row">
              <label className="form-field__label" htmlFor="login-password">
                Contraseña
              </label>
              <button type="button" className="btn-link" onClick={() => switchMode('forgot')}>
                ¿La has olvidado?
              </button>
            </div>
            <div className="password-input">
              <input
                id="login-password"
                className="text-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-input__toggle"
                aria-pressed={showPassword}
                aria-controls="login-password"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {captcha}
          {notices}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting || waitingCaptcha}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="auth-card__foot">
            Acceso restringido al equipo de Vrutal Labs.
            <br />
            Las cuentas se crean por invitación.
          </p>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="auth-card" onSubmit={handleForgot}>
          {logo}
          <h1 className="auth-card__title">Restablecer contraseña</h1>
          <p className="auth-card__subtitle">Te enviaremos un enlace a tu correo.</p>

          {emailField('forgot-email')}
          {captcha}
          {notices}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting || waitingCaptcha}>
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
          <button type="button" className="btn-link auth-card__back" onClick={() => switchMode('login')}>
            Volver al acceso
          </button>
        </form>
      )}

      {mode === 'forgot-sent' && (
        <div className="auth-card" role="status">
          {logo}
          <h1 className="auth-card__title">Revisa tu correo</h1>
          <p className="auth-card__subtitle">
            Si {email} tiene una cuenta, recibirás un enlace para crear una contraseña nueva.
          </p>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => switchMode('login')}>
            Volver al acceso
          </button>
        </div>
      )}
    </div>
  );
}
