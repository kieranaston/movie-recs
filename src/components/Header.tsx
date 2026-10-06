'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GENRE_PAGES } from '@/lib/taxonomy';
import { useViewer } from './ViewerProvider';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const viewer = useViewer();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsMenuOpen(false);
    }
  };

  const tabClass = (active: boolean) =>
    `px-2.5 py-2 text-xs whitespace-nowrap border-b-2 transition-colors inline-flex items-center gap-1 ${
      active ? 'border-primary text-white' : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
    }`;

  return (
    <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold text-white whitespace-nowrap" aria-label="Movie Discovery Home">
            Movie Discovery
          </Link>

          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="hidden md:flex w-56" role="search">
              <label htmlFor="header-search" className="sr-only">Search movies</label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                <Input
                  id="header-search"
                  type="search"
                  placeholder="Search movies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-gray-800 border-gray-700 focus:border-primary"
                />
              </div>
            </form>

            {viewer ? (
              <Link
                href="/account"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white hover:bg-gray-700"
                aria-label={`Account (${viewer.email})`}
                title={viewer.email}
              >
                {(viewer.name || viewer.email).charAt(0).toUpperCase()}
              </Link>
            ) : (
              <Link href="/login" className="text-sm text-gray-300 hover:text-white whitespace-nowrap">
                Sign in
              </Link>
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* tabs — Home + Watchlist + genres; genres with filters open a hover dropdown */}
        <div className="flex flex-wrap -mb-px" role="tablist" aria-label="Browse">
          <Link href="/" role="tab" aria-selected={pathname === '/'} className={tabClass(pathname === '/')}>
            Home
          </Link>
          {viewer && (
            <Link href="/watchlist" role="tab" aria-selected={pathname === '/watchlist'} className={tabClass(pathname === '/watchlist')}>
              Watchlist
            </Link>
          )}
          {GENRE_PAGES.map((g) => {
            const active = pathname === `/genre/${g.slug}`;
            if (g.filters.length === 0) {
              return (
                <Link key={g.slug} href={`/genre/${g.slug}`} role="tab" aria-selected={active} className={tabClass(active)}>
                  {g.name}
                </Link>
              );
            }
            return (
              <div key={g.slug} className="relative group">
                <Link href={`/genre/${g.slug}`} role="tab" aria-selected={active} className={tabClass(active)}>
                  {g.name}
                  <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                </Link>
                <div className="absolute left-0 top-full z-50 hidden group-hover:block group-focus-within:block min-w-[11rem] py-1 bg-gray-900 border border-gray-800 rounded-md shadow-xl">
                  <Link href={`/genre/${g.slug}`} className="block px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    All {g.name}
                  </Link>
                  {g.filters.map((f) => (
                    <Link
                      key={f.label}
                      href={`/genre/${g.slug}?filter=${encodeURIComponent(f.label)}`}
                      className="block px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-3 border-t border-gray-800">
            <form onSubmit={handleSearch} role="search">
              <label htmlFor="mobile-search" className="sr-only">Search movies</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                <Input
                  id="mobile-search"
                  type="search"
                  placeholder="Search movies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 focus:border-primary"
                />
              </div>
            </form>
          </div>
        )}
      </nav>
    </header>
  );
}
