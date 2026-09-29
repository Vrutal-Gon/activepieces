import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import '../styles/pages/login.css';

// 2FA obligatoria para todo el staff. El servidor también la exige:
// has_platform_role()/has_permission() solo dan acceso con sesión aal2 (migración 011).
type Gate =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok' }
  | { status: 'challenge'; factorId: string }
  | { status: 'enroll' };

async function checkMfa(): Promise<Gate> {
  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { status: 'error', message: error.message };
  if (aal.currentLevel === 'aal2') return { status: 'ok' };
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { status: 'error', message: factorsError.message };
  const verified = factors.totp.find((f) => f.status === 'verified');
  return verified ? { status: 'challenge', factorId: verified.id } : { status: 'enroll' };
}

interface MfaGateProps {
  session: Session;
  onSignOut: () => void;
  children: ReactNode;
}

export function MfaGate({ session, onSignOut, children }: MfaGateProps) {
  const [gate, setGate] = useState<Gate>({ status: 'loading' });
  const accessToken = session.access_token;

  // Se re-evalúa cuando cambia el token (p. ej. tras verificar el código, que sube la sesión a aal2).
  useEffect(() => {
    let cancelled = false;
    checkMfa().then((next) => {
      if (!cancelled) setGate(next);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (gate.status === 'ok') return <>{children}</>;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-card__logo" src="/vrutal-lockup-dark.svg" alt="Vrutal Labs" />
        {gate.status === 'loading' && <p className="auth-card__subtitle">Comprobando seguridad…</p>}
        {gate.status === 'error' && (
          <p className="notice notice--error" role="alert">
            {gate.message}
          </p>
        )}
        {gate.status === 'challenge' && <ChallengeForm factorId={gate.factorId} />}
        {gate.status === 'enroll' && <EnrollForm />}
        <button type="button" className="btn-link auth-card__back" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

interface CodeFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

function CodeField({ id, value, onChange }: CodeFieldProps) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        Código de 6 dígitos
      </label>
      <input
        id={id}
        className="text-input mfa-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        required
        autoFocus
      />
    </div>
  );
}

function ChallengeForm({ factorId }: { factorId: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setSubmitting(false);
    if (error) {
      setError('Código incorrecto o caducado. Prueba con el código actual.');
      setCode('');
    }
    // En éxito, supabase-js emite una sesión nueva (aal2) y MfaGate deja pasar.
  }

  return (
    <form className="mfa-form" onSubmit={handleSubmit}>
      <h1 className="auth-card__title">Verificación en dos pasos</h1>
      <p className="auth-card__subtitle">Abre tu app de autenticación e introduce el código.</p>
      <CodeField id="mfa-challenge-code" value={code} onChange={setCode} />
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={submitting || code.length !== 6}>
        {submitting ? 'Verificando…' : 'Verificar'}
      </button>
    </form>
  );
}

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

function EnrollForm() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Con un botón y no en un efecto: StrictMode ejecuta los efectos dos veces y crearía dos factores.
  async function startEnrollment() {
    setBusy(true);
    setError(null);
    // Limpia intentos anteriores sin terminar (factores no verificados).
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Vrutal1st ${new Date().toISOString()}`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // El QR viene de Supabase como SVG en data URL; en <img> no ejecuta scripts.
    if (!data.totp.qr_code.startsWith('data:image/svg+xml')) {
      setError('Respuesta inesperada al generar el QR.');
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });
    setBusy(false);
    if (error) {
      setError('Código incorrecto. Comprueba que la hora del móvil es automática y prueba con el código actual.');
      setCode('');
    }
  }

  if (!enrollment) {
    return (
      <div className="mfa-form">
        <h1 className="auth-card__title">Activa la verificación en dos pasos</h1>
        <p className="auth-card__subtitle">
          Es obligatoria para el equipo Vrutal. Necesitas una app de autenticación (Google Authenticator, 1Password,
          Authy…).
        </p>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={startEnrollment}>
          {busy ? 'Preparando…' : 'Configurar ahora'}
        </button>
      </div>
    );
  }

  return (
    <form className="mfa-form" onSubmit={handleVerify}>
      <h1 className="auth-card__title">Escanea el código QR</h1>
      <p className="auth-card__subtitle">Con tu app de autenticación. Después escribe el código que te muestra.</p>
      <img className="mfa-qr" src={enrollment.qrCode} alt="Código QR para la app de autenticación" />
      <details className="mfa-secret">
        <summary>¿No puedes escanear? Introduce la clave a mano</summary>
        <code className="mfa-secret__value">{enrollment.secret}</code>
      </details>
      <CodeField id="mfa-enroll-code" value={code} onChange={setCode} />
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--primary btn--block" disabled={busy || code.length !== 6}>
        {busy ? 'Verificando…' : 'Activar'}
      </button>
    </form>
  );
}
