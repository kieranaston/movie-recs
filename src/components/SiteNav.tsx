'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GENRE_PAGES } from '@/lib/taxonomy';
import { useViewer } from './ViewerProvider';

/**
 * Site navigation without a header bar: a floating menu button opens a drawer from the left with
 * search, every page stacked vertically (the current one marked), and account. Pages get the
 * whole screen. Only primary genres are listed; their filters are chips on the genre page itself.
 */
export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const currentGenre = pathname.startsWith('/genre/') ? pathname.slice('/genre/'.length) : null;

  const openDrawer = () => setOpen(true);
  const close = () => setOpen(false);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // While open: Escape closes, the page behind doesn't scroll, focus moves into the drawer
  // (onto the current page) and returns to the menu button afterwards.
  useEffect(() => {
    if (!open) return;
    const button = menuButton.current;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus (and so scroll to) the current page; not the search box, which would pop up a phone keyboard.
    // Wait two frames: the drawer only becomes visible (and focusable) once its transition starts.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const current = drawer.current?.querySelector<HTMLElement>('a[aria-current="page"]');
        const target = current ?? drawer.current?.querySelector<HTMLElement>('button[aria-label="Close menu"]');
        target?.focus({ preventScroll: true });
        current?.scrollIntoView({ block: 'center' });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      button?.focus();
    };
  }, [open]);

  /** A drawer row; the current page gets a red bar on the left. */
  const item = (current: boolean) =>
    `relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      current
        ? 'bg-gray-800 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-primary'
        : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
    }`;

  return (
    <>
      <button
        ref={menuButton}
        type="button"
        onClick={openDrawer}
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700/60 bg-gray-950/70 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-gray-800"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="nav-drawer"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        id="nav-drawer"
        ref={drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        // Hidden when closed (after the slide-out finishes), so it's out of the tab order and screen readers.
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-gray-800 bg-gray-950 shadow-2xl transition-[transform,visibility] duration-200 ease-out ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Link href="/" onClick={close} className="text-lg font-bold text-white">
            Movie Discovery
          </Link>
          <button type="button" onClick={close} className="rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submitSearch} role="search" className="shrink-0 px-4 pb-3">
          <label htmlFor="nav-search" className="sr-only">Search movies</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <Input
              id="nav-search"
              type="search"
              placeholder="Search movies…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-10 bg-gray-800 border-gray-700 focus:border-primary"
            />
          </div>
        </form>

        <nav className="flex-1 overflow-y-auto border-t border-gray-800 px-3 py-3" aria-label="Pages">
          <ul className="space-y-1">
            <li>
              <Link href="/" onClick={close} className={item(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
                Home
              </Link>
            </li>
            {viewer && (
              <li>
                <Link href="/watchlist" onClick={close} className={item(pathname === '/watchlist')} aria-current={pathname === '/watchlist' ? 'page' : undefined}>
                  Watchlist
                </Link>
              </li>
            )}
            {pathname === '/search' && (
              <li>
                <span className={item(true)} aria-current="page">Search results</span>
              </li>
            )}
          </ul>

          <h2 className="mb-2 mt-5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Genres</h2>
          <ul className="space-y-1">
            {GENRE_PAGES.map((g) => {
              const here = currentGenre === g.slug; // includes filtered views (e.g. Horror → Slasher)
              return (
                <li key={g.slug}>
                  <Link href={`/genre/${g.slug}`} onClick={close} className={item(here)} aria-current={here ? 'page' : undefined}>
                    {g.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-gray-800 p-3">
          {viewer ? (
            <Link href="/account" onClick={close} className={item(pathname === '/account')} aria-current={pathname === '/account' ? 'page' : undefined}>
              <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold">
                {(viewer.name || viewer.email).charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{viewer.email}</span>
            </Link>
          ) : (
            <Link href="/login" onClick={close} className="flex w-full justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-white hover:bg-red-700">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
