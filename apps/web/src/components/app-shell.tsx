'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ComponentType, type ReactNode, type SVGProps } from 'react';

import { KeepVisitedPages } from '@/components/keep-visited-pages';
import {
  IconBox,
  IconCalendar,
  IconCash,
  IconGear,
  IconHome,
  IconLedger,
  IconPeople,
  IconPercent,
  IconSpark,
} from '@/components/icons';
import { prefetchAppRoute } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccessNav, tenantRoleLabel, type TenantRole } from '@aesthetic/shared';

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

const NAV = [
  { href: '/app', label: 'Hoy', short: 'Hoy', icon: IconHome, group: 'sala' },
  { href: '/app/agenda', label: 'Agenda', short: 'Agenda', icon: IconCalendar, group: 'sala' },
  { href: '/app/patients', label: 'Pacientes', short: 'Pacientes', icon: IconPeople, group: 'sala' },
  { href: '/app/caja', label: 'Caja', short: 'Caja', icon: IconCash, group: 'sala' },
  { href: '/app/finanzas', label: 'Dinero', short: 'Dinero', icon: IconLedger, group: 'clinica' },
  { href: '/app/services', label: 'Servicios', short: 'Servicios', icon: IconSpark, group: 'clinica' },
  { href: '/app/inventory', label: 'Inventario', short: 'Stock', icon: IconBox, group: 'clinica', pro: true },
  { href: '/app/commissions', label: 'Comisiones', short: 'Comis.', icon: IconPercent, group: 'clinica', pro: true },
  { href: '/app/settings', label: 'Ajustes', short: 'Ajustes', icon: IconGear, group: 'cuenta' },
] as const;

const GROUPS = [
  { id: 'sala', label: 'En la sala' },
  { id: 'clinica', label: 'De la clínica' },
  { id: 'cuenta', label: 'Tu cuenta' },
] as const;

const MOBILE_HREFS = ['/app', '/app/agenda', '/app/patients', '/app/caja', '/app/settings'] as const;

function navForRole(role: TenantRole) {
  return NAV.filter((item) => canAccessNav(role, item.href));
}

function mobileNavForRole(role: TenantRole) {
  const allowed = navForRole(role);
  const preferred = MOBILE_HREFS.map((href) => allowed.find((item) => item.href === href)).filter(
    (item): item is (typeof NAV)[number] => Boolean(item),
  );
  if (preferred.length === 5) return preferred;
  return allowed.slice(0, 5);
}

function isActivePath(pathname: string, href: string) {
  return href === '/app'
    ? pathname === '/app'
    : pathname === href || pathname.startsWith(`${href}/`);
}

function AppNavLink({
  href,
  active,
  className,
  token,
  children,
}: {
  href: string;
  active: boolean;
  className: string;
  token: string;
  children: ReactNode;
}) {
  const prefetch = () => prefetchAppRoute(href, token);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={className}
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, session, membership, signOut, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, router, session]);

  useEffect(() => {
    if (!loading && session && !membership) {
      router.replace('/bootstrap');
    }
  }, [loading, membership, router, session]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-muted">
        Cargando clínica…
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-muted">
        {loading ? 'Cargando clínica…' : 'Redirigiendo…'}
      </div>
    );
  }

  const nav = navForRole(membership.role);
  const mobileNav = mobileNavForRole(membership.role);
  const accessToken = token ?? '';

  return (
    <div className="atmosphere min-h-screen">
      <a href="#contenido" className="skip-link">
        Ir al contenido
      </a>
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-4 pb-28 pt-6 lg:grid-cols-[15.5rem_1fr] lg:px-8 lg:pb-10 lg:pt-8">
        <aside className="panel hidden h-fit p-5 lg:sticky lg:top-6 lg:block">
          <div className="mb-6 px-1">
            <p className="brand-mark text-2xl text-botanical" translate="no">
              Aesthetic
            </p>
            <p className="mt-1 truncate text-sm text-muted">
              {membership.fullName}
            </p>
            <p className="truncate text-sm text-muted">{tenantRoleLabel(membership.role)}</p>
          </div>
          <nav aria-label="Principal" className="flex flex-col">
            {GROUPS.map((group) => {
              const items = nav.filter((item) => item.group === group.id);
              if (items.length === 0) return null;
              return (
                <div key={group.id}>
                  <p className="nav-group">{group.label}</p>
                  {items.map((item) => {
                    const Icon = item.icon as IconCmp;
                    return (
                      <AppNavLink
                        key={item.href}
                        href={item.href}
                        active={isActivePath(pathname, item.href)}
                        className="nav-link"
                        token={accessToken}
                      >
                        <Icon className="nav-icon" />
                        <span className="min-w-0 truncate">{item.label}</span>
                        {'pro' in item && item.pro ? (
                          <span className="nav-pro ml-auto text-[10px] uppercase tracking-wide opacity-70">
                            Pro
                          </span>
                        ) : null}
                      </AppNavLink>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <button
            type="button"
            className="btn btn-ghost mt-6 w-full"
            onClick={() => void signOut().then(() => router.push('/login'))}
          >
            Cerrar sesión
          </button>
        </aside>

        <main id="contenido" className="min-w-0 pb-4">
          <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
            <p className="brand-mark text-2xl text-botanical" translate="no">
              Aesthetic
            </p>
            <p className="max-w-[45%] truncate text-sm text-muted">{membership.fullName}</p>
          </div>
          <KeepVisitedPages>{children}</KeepVisitedPages>
        </main>
      </div>

      <nav
        aria-label="Móvil"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
          {mobileNav.map((item) => {
            const Icon = item.icon as IconCmp;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <AppNavLink
                  href={item.href}
                  active={isActivePath(pathname, item.href)}
                  className="nav-link-mobile"
                  token={accessToken}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{item.short}</span>
                </AppNavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
