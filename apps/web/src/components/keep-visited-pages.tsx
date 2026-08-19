'use client';

import { useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const KEEP_ALIVE = new Set([
  '/app',
  '/app/agenda',
  '/app/patients',
  '/app/caja',
  '/app/finanzas',
  '/app/services',
  '/app/inventory',
  '/app/commissions',
  '/app/settings',
]);

/**
 * Keeps main nav screens mounted so switching tabs restores UI instead of
 * remounting. Dynamic routes (patient detail) are not cached.
 */
export function KeepVisitedPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cacheRef = useRef<Map<string, ReactNode>>(new Map());
  const cache = cacheRef.current;
  const keepAlive = KEEP_ALIVE.has(pathname);

  if (keepAlive && !cache.has(pathname)) {
    cache.set(pathname, children);
  }

  return (
    <>
      {[...cache.entries()].map(([path, node]) => {
        const active = path === pathname;
        return (
          <div key={path} hidden={!active} aria-hidden={!active} inert={!active || undefined}>
            {node}
          </div>
        );
      })}
      {keepAlive ? null : children}
    </>
  );
}
