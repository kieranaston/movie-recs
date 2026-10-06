import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { ActivateDevice } from './ActivateDevice';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connect your TV', robots: { index: false, follow: false } };

/** Target of the TV's QR code: approve (or deny) a TV sign-in request for the signed-in user. */
export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ user_code?: string }> }) {
  const raw = (await searchParams).user_code ?? '';
  const code = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16);

  if (!(await getViewer())) {
    redirect(`/login?next=${encodeURIComponent(code ? `/activate?user_code=${code}` : '/activate')}`);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-white mb-2">Connect your TV</h1>
      <ActivateDevice initialCode={code} />
    </div>
  );
}
