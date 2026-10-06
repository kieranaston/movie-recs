'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function GoogleSignIn({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async () => {
    setPending(true);
    setFailed(false);
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: next,
      errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
    });
    // On success the browser is already navigating to Google.
    if (error) {
      setFailed(true);
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={signIn} disabled={pending} className="w-full h-11 bg-white text-gray-900 hover:bg-gray-200">
        {pending ? 'Redirecting…' : 'Continue with Google'}
      </Button>
      {failed && <p className="text-sm text-red-400" role="alert">Couldn&apos;t start sign-in. Please try again.</p>}
    </div>
  );
}
