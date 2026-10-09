'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GENRE_PAGES } from '@/lib/taxonomy';
import { useViewer } from './ViewerProvider';

/**
 * Site navigation: a slim header (menu button, logo, search, account) and a drawer that slides in
 * from the left with every page stacked vertically. Same on phones and desktop; nothing relies on hover.
 */
export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // phone search row
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null); // genre showing its filters
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setSearchOpen(false);
  };

  const openDrawer = () => {
    // Start with the current genre's filters showing.
    setExpanded(pathname.startsWith('/genre/') ? pathname.slice('/genre/'.length) : null);
    setSearchOpen(false);
    setOpen(true);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // While open: Escape closes, the page behind doesn't scroll, focus moves into the drawer
  // and returns to the menu button afterwards.
  useEffect(() => {
    if (!open) return;
    const button = menuButton.current;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('a, button, input')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      button?.focus();
    };
  }, [open]);

  const filter = searchParams.get('filter');
  const item = (active: boolean) =>
    `flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8" aria-label="Main">
          <button
            ref={menuButton}
            type="button"
            onClick={openDrawer}
            className="-ml-2 rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="nav-drawer"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/" onClick={close} className="whitespace-nowrap text-lg font-bold text-white">
            Movie Discovery
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden w-64 md:block">{searchField('header-search')}</div>
            <button
              type="button"
              className="rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white md:hidden"
              aria-label={searchOpen ? 'Close search' : 'Search'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((o) => !o)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            {viewer ? (
              <Link
                href="/account"
                onClick={close}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white hover:bg-gray-700"
                aria-label={`Account (${viewer.email})`}
                title={viewer.email}
              >
                {(viewer.name || viewer.email).charAt(0).toUpperCase()}
              </Link>
            ) : (
              <Link href="/login" onClick={close} className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                Sign in
              </Link>
            )}
          </div>
        </nav>
        {searchOpen && <div className="border-t border-gray-800 px-4 py-3 md:hidden">{searchField('mobile-search', true)}</div>}
      </header>

      {/* Drawer — outside <header>: its backdrop-filter would trap position:fixed children. */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
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
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-800 px-4">
          <span className="text-lg font-bold text-white">Menu</span>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-300 hover:bg-gray-800 hover:text-white" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Pages">
          <div className="mb-4 px-1 md:hidden">{searchField('drawer-search')}</div>

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
          </ul>

          <h2 className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Genres</h2>
          <ul className="space-y-1">
            {GENRE_PAGES.map((g) => {
              const here = pathname === `/genre/${g.slug}`;
              const isOpen = expanded === g.slug;
              return (
                <li key={g.slug}>
                  <div className="flex items-center">
                    <Link href={`/genre/${g.slug}`} onClick={close} className={item(here && !filter)} aria-current={here && !filter ? 'page' : undefined}>
                      {g.name}
                    </Link>
                    {g.filters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : g.slug)}
                        className="ml-1 shrink-0 rounded-lg p-2.5 text-gray-400 hover:bg-gray-800/60 hover:text-white"
                        aria-label={`${isOpen ? 'Hide' : 'Show'} ${g.name} filters`}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <ul className="mb-1 ml-3 mt-1 space-y-1 border-l border-gray-800 pl-3">
                      {g.filters.map((f) => {
                        const active = here && filter === f.label;
                        return (
                          <li key={f.label}>
                            <Link
                              href={`/genre/${g.slug}?filter=${encodeURIComponent(f.label)}`}
                              onClick={close}
                              className={`${item(active)} py-2 text-[13px]`}
                              aria-current={active ? 'page' : undefined}
                            >
                              {f.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-gray-800 p-3">
          {viewer ? (
            <Link href="/account" onClick={close} className={item(pathname === '/account')}>
              <span className="truncate">Account · {viewer.email}</span>
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
