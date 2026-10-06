'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { revokeDevice } from './actions';

export function RevokeButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button onClick={() => start(() => revokeDevice(sessionId))} disabled={pending} className="h-8 px-3 text-xs bg-gray-800 hover:bg-gray-700">
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.push('/');
          router.refresh();
        })
      }
      disabled={pending}
      className="h-10 px-4 bg-gray-800 hover:bg-gray-700"
    >
      {pending ? 'Signing out…' : 'Sign out of this browser'}
    </Button>
  );
}
