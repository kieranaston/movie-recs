import { requireUser } from '@/lib/api';
import { GENRE_PAGES, SECTIONS } from '@/lib/taxonomy';

export async function GET(request: Request) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;

  return Response.json({
    genres: GENRE_PAGES.map((g) => ({ slug: g.slug, name: g.name, filters: g.filters.map((f) => f.label) })),
    sections: SECTIONS.map((s) => ({ id: s.id, label: s.label })),
  });
}
