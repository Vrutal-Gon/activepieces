import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import '../styles/pages/login.css';

// Debe coincidir con "Minimum password length" en Supabase Auth (el servidor es quien manda).
const MIN_PASSWORD_LENGTH = 12;

interface SetNewPasswordFormProps {
  onDone: () => void;
}

export function SetNewPasswordForm({ onDone }: SetNewPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img className="auth-card__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
        <h1 className="auth-card__title">Nueva contraseña</h1>
        <p className="auth-card__subtitle">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>

        <div className="form-field">
          <label className="form-field__label" htmlFor="new-password">
            Nueva contraseña
          </label>
          <input
            id="new-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <div className="form-field">
          <label className="form-field__label" htmlFor="confirm-password">
            Repetir contraseña
          </label>
          <input
            id="confirm-password"
            className="text-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>

        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  );
}
