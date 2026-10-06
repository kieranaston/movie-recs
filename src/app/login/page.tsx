import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { safeNext } from '@/lib/safe-redirect';
import { GoogleSignIn } from './GoogleSignIn';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  not_allowed: 'That Google account isn’t on the invite list.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getViewer()) redirect(next);

  const error = params.error ? (ERRORS[params.error] ?? 'Sign-in failed. Please try again.') : null;

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-white mb-2">Sign in</h1>
      <p className="text-sm text-gray-400 mb-6">Sign in to keep your own watchlist and connect your TV.</p>
      {error && <p className="mb-4 text-sm text-red-400" role="alert">{error}</p>}
      <GoogleSignIn next={next} />
    </div>
  );
}
