export function Footer() {
  return (
    <footer className="border-t border-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
        <p className="mb-2">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <p className="mb-2">
          Streaming availability data provided by{' '}
          <a
            href="https://www.justwatch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            JustWatch
          </a>
          .
        </p>
        <p>
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            The Movie Database (TMDB)
          </a>
        </p>
      </div>
    </footer>
  );
}
