'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { TenantRole } from '@aesthetic/shared';

import { ApiError, apiFetch, clearApiCache } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

export type Membership = {
  tenantId: string;
  role: TenantRole;
  authUserId: string;
  membershipId: string;
  fullName: string;
  email?: string;
  locationIds: string[];
};

type AuthState = {
  user: User | null;
  session: Session | null;
  membership: Membership | null;
  /** True until session + membership lookup have settled. */
  loading: boolean;
  refreshMembership: () => Promise<Membership | null>;
  signIn: (email: string, password: string) => Promise<Membership | null>;
  signOut: () => Promise<void>;
  token: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const membershipRef = useRef<Membership | null>(null);
  membershipRef.current = membership;

  const refreshMembership = useCallback(async (): Promise<Membership | null> => {
    if (!supabase) {
      setMembership(null);
      return null;
    }
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setMembership(null);
      return null;
    }
    try {
      const me = await apiFetch<Membership>('/v1/auth/me', { token, skipCache: true });
      const next = { ...me, locationIds: me.locationIds ?? [] };
      setMembership(next);
      return next;
    } catch (err) {
      // Only "no clinic" should clear membership. Other API failures must not
      // bounce a configured user into the bootstrap form.
      if (err instanceof ApiError && err.code === 'NO_ACTIVE_MEMBERSHIP') {
        setMembership(null);
        return null;
      }
      throw err;
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let syncGeneration = 0;
    let didInit = false;

    const syncSession = async (event: AuthChangeEvent | 'GET_SESSION', next: Session | null) => {
      if (event === 'INITIAL_SESSION' || event === 'GET_SESSION') {
        if (didInit) return;
        didInit = true;
      }

      const generation = ++syncGeneration;
      setSession(next);

      const signedOut = event === 'SIGNED_OUT' || !next;
      const needsMembership =
        event === 'INITIAL_SESSION' ||
        event === 'GET_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED';
      const blockUi = !membershipRef.current && (needsMembership || signedOut);

      if (blockUi) setLoading(true);

      try {
        if (!next) {
          clearApiCache();
          setMembership(null);
        } else if (needsMembership || !membershipRef.current) {
          await refreshMembership();
        }
      } catch {
        if (!next) setMembership(null);
      }

      if (mounted && generation === syncGeneration) {
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      void syncSession('GET_SESSION', data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      void syncSession(event, next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshMembership, supabase]);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      membership,
      loading,
      refreshMembership,
      token: session?.access_token ?? null,
      async signIn(email, password) {
        if (!supabase) {
          throw new Error(
            'Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.',
          );
        }
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setLoading(false);
          throw error;
        }
        setSession(data.session);
        try {
          const me = data.session ? await refreshMembership() : null;
          setLoading(false);
          return me;
        } catch (err) {
          setLoading(false);
          throw err instanceof Error
            ? err
            : new Error('No se pudo verificar la clínica. ¿Está corriendo la API?');
        }
      },
      async signOut() {
        if (!supabase) return;
        setLoading(true);
        clearApiCache();
        await supabase.auth.signOut();
        setMembership(null);
        setSession(null);
        setLoading(false);
      },
    }),
    [loading, membership, refreshMembership, session, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
