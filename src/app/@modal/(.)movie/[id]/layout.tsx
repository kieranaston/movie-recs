import { MovieModal } from '@/components/MovieModal';

/** The popup frame stays mounted while the movie loads, so it opens the instant you click. */
export default function MovieModalLayout({ children }: { children: React.ReactNode }) {
  return <MovieModal>{children}</MovieModal>;
}
