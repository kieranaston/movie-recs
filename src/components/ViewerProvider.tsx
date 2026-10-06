'use client';

import { createContext, useContext } from 'react';

/** What the browser may know about the signed-in user. UI hint only — the server re-checks every mutation. */
export interface ClientViewer {
  email: string;
  name: string;
  image: string | null;
}

const ViewerContext = createContext<ClientViewer | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: ClientViewer | null; children: React.ReactNode }) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export const useViewer = () => useContext(ViewerContext);
