import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    <div className="center">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Nueva contraseña</h1>
        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Repetir contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  );
}
