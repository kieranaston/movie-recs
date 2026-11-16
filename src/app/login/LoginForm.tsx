'use client';

import { useActionState } from 'react';
import { login } from './actions';

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        type="password"
        name="password"
        required
        autoFocus
        autoComplete="current-password"
        aria-label="Password"
        placeholder="Password"
        className="rounded-lg bg-gray-800 px-4 py-2.5 text-white placeholder:text-gray-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gray-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-60"
      >
        Sign in
      </button>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
