'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export function RoleGate({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!allowed) router.replace('/app');
  }, [allowed, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        Redirigiendo…
      </div>
    );
  }

  return children;
}
