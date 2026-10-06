import { requireUser } from '@/lib/api';

/** GET /api/v1/me → who this token belongs to (shown on the TV's About screen). */
export async function GET(request: Request) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;
  return Response.json({ email: viewer.email, name: viewer.name });
}
