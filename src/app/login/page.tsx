import { isOwner } from '@/lib/owner';
import { LoginForm } from './LoginForm';
import { logout } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const signedIn = await isOwner();
  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-4 text-xl font-bold text-white">{signedIn ? 'Signed in' : 'Sign in'}</h1>
      {signedIn ? (
        <form action={logout}>
          <p className="mb-3 text-gray-400">You can edit the watchlist, watched list and ratings.</p>
          <button className="rounded-lg bg-gray-700 px-4 py-2.5 font-medium text-white hover:bg-gray-600">Sign out</button>
        </form>
      ) : (
        <>
          <p className="mb-3 text-gray-400">Only the owner can change the watchlist and ratings.</p>
          <LoginForm />
        </>
      )}
    </div>
  );
}
