'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

type Step =
  | { kind: 'enter'; error?: string }
  | { kind: 'checking' }
  | { kind: 'confirm'; code: string }
  | { kind: 'working'; code: string }
  | { kind: 'approved' }
  | { kind: 'denied' };

const pretty = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);
const normalize = (code: string) => code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

/** Claims the request for this account and checks it is still waiting for approval. */
async function verify(code: string): Promise<Step> {
  const { data, error } = await authClient.device({ query: { user_code: code } });
  if (error || !data) return { kind: 'enter', error: 'That code isn’t valid or has expired. Check the code on your TV.' };
  if (data.status !== 'pending') return { kind: 'enter', error: 'That code has already been used. Ask your TV for a new one.' };
  return { kind: 'confirm', code };
}

export function ActivateDevice({ initialCode }: { initialCode: string }) {
  const [step, setStep] = useState<Step>(initialCode ? { kind: 'checking' } : { kind: 'enter' });
  const [typed, setTyped] = useState('');

  // The QR link carries the code: verify it once on load.
  useEffect(() => {
    if (initialCode) void verify(initialCode).then(setStep);
  }, [initialCode]);

  const check = async (code: string) => {
    setStep({ kind: 'checking' });
    setStep(await verify(code));
  };

  const decide = async (code: string, approve: boolean) => {
    setStep({ kind: 'working', code });
    const { error } = approve
      ? await authClient.device.approve({ userCode: code })
      : await authClient.device.deny({ userCode: code });
    if (error) setStep({ kind: 'enter', error: 'Something went wrong. Ask your TV for a new code and try again.' });
    else setStep({ kind: approve ? 'approved' : 'denied' });
  };

  switch (step.kind) {
    case 'checking':
      return <p className="text-gray-400">Checking code…</p>;
    case 'approved':
      return <p className="text-gray-300">Your TV is signed in. You can close this page.</p>;
    case 'denied':
      return <p className="text-gray-300">Request denied. Your TV was not signed in.</p>;
    case 'confirm':
    case 'working':
      return (
        <div className="space-y-6">
          <p className="text-gray-300">Sign in to Movie Recs on a TV? Only approve if this code matches the one on your TV screen:</p>
          <p className="text-center font-mono text-3xl tracking-widest text-white" data-testid="user-code">{pretty(step.code)}</p>
          <div className="flex gap-3">
            <Button onClick={() => decide(step.code, true)} disabled={step.kind === 'working'} className="flex-1 h-11 bg-primary hover:bg-red-700">
              Approve
            </Button>
            <Button onClick={() => decide(step.code, false)} disabled={step.kind === 'working'} className="flex-1 h-11 bg-gray-800 hover:bg-gray-700">
              Deny
            </Button>
          </div>
        </div>
      );
    case 'enter':
      return (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const code = normalize(typed);
            if (code) void check(code);
          }}
        >
          <p className="text-gray-400">Enter the code shown on your TV.</p>
          <label htmlFor="user-code" className="sr-only">Code from your TV</label>
          <Input
            id="user-code"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="ABCD-EFGH"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={16}
            className="h-12 text-center font-mono text-xl tracking-widest bg-gray-800 border-gray-700"
          />
          {step.error && <p className="text-sm text-red-400" role="alert">{step.error}</p>}
          <Button type="submit" className="w-full h-11 bg-primary hover:bg-red-700">Continue</Button>
        </form>
      );
  }
}
