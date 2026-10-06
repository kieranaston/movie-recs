import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, getViewer } from '@/lib/auth';
import { describeDevice } from './devices';
import { RevokeButton, SignOutButton } from './AccountControls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account', robots: { index: false, follow: false } };

const date = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' });

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent('/account')}`);

  const h = await headers();
  const [sessions, current] = await Promise.all([auth.api.listSessions({ headers: h }), auth.api.getSession({ headers: h })]);
  const devices = sessions
    .map((s) => ({ id: s.id, lastActive: s.updatedAt, since: s.createdAt, ...describeDevice(s.userAgent), current: s.id === current?.session.id }))
    .sort((a, b) => Number(b.current) - Number(a.current) || +new Date(b.lastActive) - +new Date(a.lastActive));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-white mb-1">Account</h1>
        <p className="text-gray-400">{viewer.email}</p>
      </section>

      <section aria-labelledby="devices-heading">
        <h2 id="devices-heading" className="text-lg font-semibold text-white mb-3">Signed-in devices</h2>
        <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-white">
                  {d.label}
                  {d.current && <span className="ml-2 text-xs text-gray-400">(this browser)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  Signed in {date.format(new Date(d.since))} · last active {date.format(new Date(d.lastActive))}
                </p>
              </div>
              {!d.current && <RevokeButton sessionId={d.id} />}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">To connect a TV, open Movie Recs on it and scan the code it shows.</p>
      </section>

      <SignOutButton />
    </div>
  );
}
