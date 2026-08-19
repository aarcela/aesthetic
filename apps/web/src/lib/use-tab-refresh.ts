'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

function isTabActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname === href;
}

/** Reloads a keep-alive tab when it becomes visible again, without blanking UI. */
export function useTabRefresh(
  href: string,
  reload: () => void | Promise<void>,
  enabled: boolean,
) {
  const pathname = usePathname();
  const active = enabled && isTabActive(pathname, href);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!active) return;
    void reloadRef.current();
  }, [active]);
}
