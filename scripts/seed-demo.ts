#!/usr/bin/env tsx
/**
 * Seeds a demo clinic via the Nest API + Supabase Auth admin.
 *
 * Required env (from apps/api/.env or process):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 *   API_URL (default http://localhost:3001/api)
 *
 * Usage (API must be running with ALLOW_TENANT_BOOTSTRAP=true):
 *   pnpm seed:demo
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';

const DEMO_EMAIL = process.env.SEED_EMAIL ?? 'demo@aesthetic.local';
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'AestheticDemo123!';

async function api<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} → ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function ensureService(
  token: string,
  existing: Array<{ id: string; name: string }>,
  service: { name: string; basePriceUsd: number; estimatedDurationMinutes: number },
) {
  const found = existing.find((s) => s.name === service.name);
  if (found) return found;
  return api<{ id: string; name: string }>('/v1/services', token, {
    method: 'POST',
    body: JSON.stringify(service),
  });
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Creating/updating demo auth user…');
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = listed.data.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Owner Demo' },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error('Could not create user');
    }
    user = created.data.user;
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
  }

  const signIn = await anon.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signIn.error || !signIn.data.session) {
    throw signIn.error ?? new Error('Could not sign in demo user');
  }
  const token = signIn.data.session.access_token;

  let membership: { membershipId: string; tenantId: string } | null = null;
  try {
    membership = await api('/v1/auth/me', token);
    console.log('Membership already exists, reusing clinic.');
  } catch {
    console.log('Bootstrapping clinic…');
    membership = await api('/v1/auth/bootstrap-tenant', token, {
      method: 'POST',
      body: JSON.stringify({
        clinicName: 'Clínica Lumina Demo',
        fullName: 'Owner Demo',
        defaultFxFuente: 'oficial',
      }),
    });
  }

  await api('/v1/tenant-settings/plan', token, {
    method: 'PUT',
    body: JSON.stringify({ planCode: 'pro', subscriptionStatus: 'active' }),
  });

  const locations = await api<Array<{ id: string; isPrimary: boolean }>>(
    '/v1/locations',
    token,
  );
  const locationId = locations.find((l) => l.isPrimary)?.id ?? locations[0]?.id;
  if (!locationId) throw new Error('No location after bootstrap');

  const existingServices = await api<Array<{ id: string; name: string }>>(
    '/v1/services',
    token,
  );
  const serviceDefs = [
    { name: 'Labios 1ml', basePriceUsd: 280, estimatedDurationMinutes: 45 },
    { name: 'Toxina 50U', basePriceUsd: 220, estimatedDurationMinutes: 30 },
    { name: 'Limpieza facial', basePriceUsd: 60, estimatedDurationMinutes: 50 },
  ];
  const createdServices = [];
  for (const service of serviceDefs) {
    createdServices.push(await ensureService(token, existingServices, service));
  }

  const patients = await api<
    Array<{ id: string; firstName: string; lastName: string; phoneNumber: string }>
  >('/v1/patients', token);
  let patient = patients.find(
    (p) => p.firstName === 'Ana' && p.lastName === 'Pérez',
  );
  if (!patient) {
    patient = await api('/v1/patients', token, {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Ana',
        lastName: 'Pérez',
        phoneNumber: '+584121110000',
      }),
    });
  }

  const inventory = await api<Array<{ id: string; productName: string }>>(
    '/v1/inventory/items',
    token,
  );
  let filler = inventory.find((i) => i.productName === 'Juvederm Ultra');
  if (!filler) {
    filler = await api('/v1/inventory/items', token, {
      method: 'POST',
      body: JSON.stringify({
        productName: 'Juvederm Ultra',
        itemKind: 'MATERIAL',
        unitOfMeasure: 'ml',
        packageCapacity: 1,
        currentStock: 12,
        minStockAlert: 3,
        costPerUnitUsd: 85,
        locationId,
      }),
    });
  }

  try {
    await api('/v1/inventory/recipes', token, {
      method: 'POST',
      body: JSON.stringify({
        serviceId: createdServices[0].id,
        inventoryItemId: filler.id,
        quantityRequired: 1,
      }),
    });
  } catch {
    console.log('Recipe already present (or conflict) — continuing.');
  }

  const rules = await api<Array<{ id: string }>>('/v1/commissions/rules', token);
  if (rules.length === 0) {
    await api('/v1/commissions/rules', token, {
      method: 'POST',
      body: JSON.stringify({
        specialistMembershipId: membership!.membershipId,
        ruleType: 'PERCENT_NET_MATERIALS',
        ratePercent: 30,
        priority: 10,
      }),
    });
  }

  const when = new Date();
  when.setHours(when.getHours() + 2);
  await api('/v1/appointments', token, {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      patientId: patient.id,
      scheduledAt: when.toISOString(),
      items: [
        {
          serviceId: createdServices[0].id,
          specialistId: membership!.membershipId,
          quantity: 1,
          unitPriceUsd: 280,
        },
      ],
    }),
  });

  console.log('\nDemo ready');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  tenant:   ${membership!.tenantId}`);
  console.log('  plan:     pro / active');
  console.log('Open http://localhost:3000/login');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
