import { useState, type FormEvent } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { supabase, TENANT_NAME } from '../lib/supabaseClient';
import '../styles/pages/auth.css';

type Mode = 'login' | 'forgot' | 'forgot-sent';

// Mensajes que no revelan si el correo existe.
function authErrorMessage(error: AuthError, fallback: string): string {
  if (error.status === 429) return 'Demasiados intentos. Espera unos minutos.';
  return fallback;
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(authErrorMessage(error, 'Correo o contraseña no válidos.'));
    setSubmitting(false);
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setSubmitting(false);
    if (error && error.status === 429) {
      setError(authErrorMessage(error, ''));
      return;
    }
    // Cualquier otro caso: misma respuesta, exista o no la cuenta.
    setMode('forgot-sent');
  }

  const errorNotice = error && (
    <p className="notice notice--error" role="alert">
      {error}
    </p>
  );

  const emailField = (id: string) => (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        Correo
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
          <h1 className="auth-card__title">Entrar</h1>
          {TENANT_NAME && <p className="auth-card__subtitle">{TENANT_NAME}</p>}

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

          {errorNotice}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="auth-card" onSubmit={handleForgot}>
          {logo}
          <h1 className="auth-card__title">Restablecer contraseña</h1>
          <p className="auth-card__subtitle">Te enviaremos un enlace a tu correo.</p>

          {emailField('forgot-email')}
          {errorNotice}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
          <button type="button" className="btn-link auth-card__back" onClick={() => switchMode('login')}>
            Volver
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
            Volver
          </button>
        </div>
      )}
    </div>
  );
}
