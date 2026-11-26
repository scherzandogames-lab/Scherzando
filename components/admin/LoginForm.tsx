'use client';
import { useActionState } from 'react';
import { login } from '@/app/admin/actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null as null | { error: string });
  return (
    <form action={action} className="adm-login">
      <h1>Panel de SCHERZANDO</h1>
      <label className="f">Contraseña<input id="password" name="password" type="password" required autoComplete="current-password" autoFocus /></label>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn btn-gold btn-wide" disabled={pending}>{pending ? 'Verificando…' : 'Entrar'}</button>
    </form>
  );
}
