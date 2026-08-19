const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const GET_TTL_MS = 45_000;

type CacheEntry = { at: number; data: unknown };

const getCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function cacheKey(path: string) {
  return `GET ${path}`;
}

export function peekApiCache<T>(path: string): T | undefined {
  const hit = getCache.get(cacheKey(path));
  if (!hit) return undefined;
  if (Date.now() - hit.at > GET_TTL_MS) {
    getCache.delete(cacheKey(path));
    return undefined;
  }
  return hit.data as T;
}

export function clearApiCache() {
  getCache.clear();
  inflight.clear();
}

type ApiFetchOptions = RequestInit & {
  token?: string | null;
  skipCache?: boolean;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: { message?: string | { message?: string }; code?: string; error?: string } | null =
    null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const rawMessage = data?.message;
    const nested =
      rawMessage && typeof rawMessage === 'object'
        ? (rawMessage as { message?: string; code?: string })
        : null;
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : nested?.message ?? data?.error ?? 'Error de API';
    throw new ApiError(message, response.status, nested?.code ?? data?.code);
  }

  return data as T;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, skipCache, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';
  const key = cacheKey(path);

  if (isGet && !skipCache) {
    const hit = peekApiCache<T>(path);
    if (hit !== undefined) return hit;
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = fetch(`${API_URL}${path}`, {
    ...rest,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }).then((response) => parseResponse<T>(response));

  if (isGet && !skipCache) {
    inflight.set(key, request);
  }

  try {
    const data = await request;
    if (isGet) {
      getCache.set(key, { at: Date.now(), data });
    } else {
      clearApiCache();
    }
    return data;
  } finally {
    inflight.delete(key);
  }
}

const CATALOG_PATHS = [
  '/v1/patients',
  '/v1/services',
  '/v1/locations',
  '/v1/payment-methods',
  '/v1/fx/rates',
] as const;

export function prefetchClinicCatalog(token: string) {
  void Promise.all(
    CATALOG_PATHS.map((path) => apiFetch(path, { token }).catch(() => undefined)),
  );
}

export function prefetchAppRoute(href: string, token: string) {
  prefetchClinicCatalog(token);
  if (href === '/app' || href === '/app/caja') {
    const date = new Date().toISOString().slice(0, 10);
    void apiFetch(`/v1/reports/caja/daily?date=${date}`, { token }).catch(() => undefined);
  }
  if (href === '/app/inventory') {
    void apiFetch('/v1/inventory/items', { token }).catch(() => undefined);
  }
  if (href === '/app/finanzas') {
    void Promise.all([
      apiFetch('/v1/finance/types', { token }),
      apiFetch('/v1/inventory/items?kind=RETAIL', { token }),
    ]).catch(() => undefined);
  }
  if (href === '/app/commissions') {
    void apiFetch('/v1/commissions/rules', { token }).catch(() => undefined);
  }
  if (href === '/app/settings') {
    void Promise.all([
      apiFetch('/v1/tenant-settings/plan', { token }),
      apiFetch('/v1/tenant-settings/clinic', { token }),
      apiFetch('/v1/locations', { token }),
    ]).catch(() => undefined);
  }
}
