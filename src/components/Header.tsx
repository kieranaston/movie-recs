'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GENRE_PAGES } from '@/lib/taxonomy';
import { useViewer } from './ViewerProvider';

/**
 * Site navigation.
 * - Desktop (md+): Home · Genres (click-open panel) · Watchlist, inline search, account.
 * - Mobile: logo, search toggle, account, and a full-height menu with links and a genre grid.
 * Genre filters live on the genre page itself (chips), so nothing depends on hover.
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const viewer = useViewer();
  const [menuOpen, setMenuOpen] = useState(false); // mobile sheet
  const [genresOpen, setGenresOpen] = useState(false); // desktop panel
  const [searchOpen, setSearchOpen] = useState(false); // mobile search row
  const [query, setQuery] = useState('');
  const genresRef = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setMenuOpen(false);
    setGenresOpen(false);
    setSearchOpen(false);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    closeAll();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // Desktop genres panel: close on Escape or a click outside.
  useEffect(() => {
    if (!genresOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGenresOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!genresRef.current?.contains(e.target as Node)) setGenresOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [genresOpen]);

  // Mobile sheet: close on Escape and stop the page scrolling underneath.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuOpen]);

  const onGenre = pathname.startsWith('/genre/');
  const navLink = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'text-white bg-gray-800' : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
    }`;

  const searchField = (id: string, autoFocus = false) => (
    <form onSubmit={submitSearch} role="search" className="w-full">
      <label htmlFor={id} className="sr-only">Search movies</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <Input
          id={id}
          type="search"
          placeholder="Search movies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          className="h-10 pl-10 bg-gray-800 border-gray-700 focus:border-primary"
        />
      </div>
    </form>
  );

  const account = viewer ? (
    <Link
      href="/account"
      onClick={closeAll}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white hover:bg-gray-700"
      aria-label={`Account (${viewer.email})`}
      title={viewer.email}
    >
      {(viewer.name || viewer.email).charAt(0).toUpperCase()}
    </Link>
  ) : (
    <Link href="/login" onClick={closeAll} className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-red-700">
      Sign in
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8" aria-label="Main">
          <Link href="/" onClick={closeAll} className="mr-2 whitespace-nowrap text-lg font-bold text-white">
            Movie Discovery
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            <Link href="/" className={navLink(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
              Home
            </Link>

            <div className="relative" ref={genresRef}>
              <button
                type="button"
                className={navLink(onGenre || genresOpen)}
                aria-expanded={genresOpen}
                aria-controls="genres-panel"
                onClick={() => setGenresOpen((o) => !o)}
              >
                Genres
                <ChevronDown className={`h-4 w-4 transition-transform ${genresOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {genresOpen && (
                <div
                  id="genres-panel"
                  className="absolute left-0 top-full mt-2 w-[min(44rem,calc(100vw-2rem))] rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-2xl"
                >
                  <ul className="grid grid-cols-3 gap-x-6 gap-y-3 lg:grid-cols-4">
                    {GENRE_PAGES.map((g) => (
                      <li key={g.slug}>
                        <Link
                          href={`/genre/${g.slug}`}
                          onClick={closeAll}
                          className={`text-sm font-medium hover:text-white ${pathname === `/genre/${g.slug}` ? 'text-white' : 'text-gray-200'}`}
                        >
                          {g.name}
                        </Link>
                        {g.filters.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {g.filters.map((f) => (
                              <li key={f.label}>
                                <Link
                                  href={`/genre/${g.slug}?filter=${encodeURIComponent(f.label)}`}
                                  onClick={closeAll}
                                  className="text-xs text-gray-400 hover:text-white"
                                >
                                  {f.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {viewer && (
              <Link href="/watchlist" className={navLink(pathname === '/watchlist')} aria-current={pathname === '/watchlist' ? 'page' : undefined}>
                Watchlist
              </Link>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden w-56 md:block lg:w-64">{searchField('header-search')}</div>

            <button
              type="button"
              className="rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white md:hidden"
              aria-label={searchOpen ? 'Close search' : 'Search'}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((o) => !o);
                setMenuOpen(false);
              }}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>

            {account}

            <button
              type="button"
              className="rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => {
                setMenuOpen((o) => !o);
                setSearchOpen(false);
              }}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile search row */}
        {searchOpen && <div className="border-t border-gray-800 px-4 py-3 md:hidden">{searchField('mobile-search', true)}</div>}

      </header>

      {/* Mobile menu sheet — outside <header>: its backdrop-filter would trap position:fixed children */}
      {menuOpen && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-gray-800 bg-gray-950 px-4 pb-10 pt-4 md:hidden">
          <div className="mb-4">{searchField('menu-search')}</div>
          <div className="mb-6 grid grid-cols-2 gap-2">
            <Link href="/" onClick={closeAll} className={`rounded-lg px-4 py-3 text-base font-medium ${pathname === '/' ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-200'}`}>
              Home
            </Link>
            {viewer ? (
              <Link href="/watchlist" onClick={closeAll} className={`rounded-lg px-4 py-3 text-base font-medium ${pathname === '/watchlist' ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-200'}`}>
                Watchlist
              </Link>
            ) : (
              <Link href="/login" onClick={closeAll} className="rounded-lg bg-gray-900 px-4 py-3 text-base font-medium text-gray-200">
                Sign in
              </Link>
            )}
          </div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Genres</h2>
          <ul className="grid grid-cols-2 gap-2">
            {GENRE_PAGES.map((g) => {
              const active = pathname === `/genre/${g.slug}`;
              return (
                <li key={g.slug}>
                  <Link
                    href={`/genre/${g.slug}`}
                    onClick={closeAll}
                    className={`block rounded-lg px-4 py-3 text-sm font-medium ${active ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-200'}`}
                  >
                    {g.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
