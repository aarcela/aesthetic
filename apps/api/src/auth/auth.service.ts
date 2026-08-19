import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  DEFAULT_PAYMENT_METHODS,
  type InviteMember,
  type TenantRole,
  type UpdateMember,
} from '@aesthetic/shared';

import { assertTeamManager } from '../tenants/tenant-context.js';

export type AuthenticatedMembership = {
  tenantId: string;
  role: TenantRole;
  authUserId: string;
  membershipId: string;
  fullName: string;
  email?: string;
  locationIds: string[];
};

@Injectable()
export class AuthService {
  private anonClient?: SupabaseClient;
  private adminClient?: SupabaseClient;

  async resolveAccessToken(accessToken: string): Promise<AuthenticatedMembership> {
    const user = await this.requireUser(accessToken);
    return this.loadActiveMembership(user);
  }

  async getMe(accessToken: string): Promise<AuthenticatedMembership> {
    return this.resolveAccessToken(accessToken);
  }

  /**
   * Creates the first clinic tenant for a signed-in user.
   * Enabled only when ALLOW_TENANT_BOOTSTRAP=true (local/staging).
   * Uses the service role so FORCE RLS does not block the initial insert.
   */
  async bootstrapTenant(input: {
    accessToken: string;
    clinicName: string;
    fullName: string;
    taxId?: string;
    defaultFxFuente?: 'oficial' | 'paralelo';
  }): Promise<AuthenticatedMembership> {
    if (process.env.ALLOW_TENANT_BOOTSTRAP?.trim() !== 'true') {
      throw new ForbiddenException({
        code: 'TENANT_BOOTSTRAP_DISABLED',
        message: 'Tenant bootstrap is disabled in this environment.',
      });
    }

    const user = await this.requireUser(input.accessToken);
    const existing = await this.findActiveMembership(user.id);
    if (existing) {
      throw new ForbiddenException({
        code: 'MEMBERSHIP_ALREADY_EXISTS',
        message: 'Este usuario ya pertenece a una clínica.',
      });
    }

    const { data: tenant, error: tenantError } = await this.admin
      .from('tenants')
      .insert({
        name: input.clinicName,
        tax_id: input.taxId ?? null,
        default_fx_fuente: input.defaultFxFuente ?? 'oficial',
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      throw new ServiceUnavailableException({
        code: 'TENANT_CREATE_FAILED',
        message: tenantError?.message ?? 'No se pudo crear la clínica.',
      });
    }

    const { data: membership, error: membershipError } = await this.admin
      .from('tenant_memberships')
      .insert({
        tenant_id: tenant.id,
        auth_user_id: user.id,
        full_name: input.fullName,
        role: 'OWNER',
        is_active: true,
      })
      .select('id, full_name')
      .single();

    if (membershipError || !membership) {
      await this.admin.from('tenants').delete().eq('id', tenant.id);
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_CREATE_FAILED',
        message: membershipError?.message ?? 'No se pudo crear la membresía.',
      });
    }

    const { data: location, error: locationError } = await this.admin
      .from('locations')
      .insert({
        tenant_id: tenant.id,
        name: 'Sede principal',
        timezone: 'America/Caracas',
        is_primary: true,
      })
      .select('id')
      .single();

    if (locationError || !location) {
      await this.admin.from('tenant_memberships').delete().eq('id', membership.id);
      await this.admin.from('tenants').delete().eq('id', tenant.id);
      throw new ServiceUnavailableException({
        code: 'LOCATION_CREATE_FAILED',
        message: locationError?.message ?? 'No se pudo crear la sede.',
      });
    }

    const { error: linkError } = await this.admin.from('membership_locations').insert({
      tenant_id: tenant.id,
      membership_id: membership.id,
      location_id: location.id,
    });

    if (linkError) {
      await this.admin.from('locations').delete().eq('id', location.id);
      await this.admin.from('tenant_memberships').delete().eq('id', membership.id);
      await this.admin.from('tenants').delete().eq('id', tenant.id);
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOCATION_FAILED',
        message: linkError.message,
      });
    }

    const { error: methodsError } = await this.admin.from('tenant_payment_methods').insert(
      DEFAULT_PAYMENT_METHODS.map((method) => ({
        tenant_id: tenant.id,
        code: method.code,
        label: method.label,
        native_currency: method.nativeCurrency,
        sort_order: method.sortOrder,
        is_system: true,
        is_active: true,
      })),
    );

    if (methodsError) {
      await this.admin.from('locations').delete().eq('tenant_id', tenant.id);
      await this.admin.from('tenant_memberships').delete().eq('id', membership.id);
      await this.admin.from('tenants').delete().eq('id', tenant.id);
      throw new ServiceUnavailableException({
        code: 'PAYMENT_METHODS_CREATE_FAILED',
        message: methodsError.message,
      });
    }

    await this.admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        tenant_id: tenant.id,
        role: 'OWNER',
        membership_id: membership.id,
      },
    });

    return {
      tenantId: tenant.id as string,
      role: 'OWNER',
      authUserId: user.id,
      membershipId: membership.id as string,
      fullName: membership.full_name as string,
      email: user.email,
      locationIds: [location.id as string],
    };
  }

  private get anon(): SupabaseClient {
    if (!this.anonClient) {
      const { url, anonKey } = this.requireConfig();
      this.anonClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.anonClient;
  }

  private get admin(): SupabaseClient {
    if (!this.adminClient) {
      const { url, serviceRoleKey } = this.requireConfig();
      this.adminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.adminClient;
  }

  private requireConfig() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceRoleKey) {
      throw new ServiceUnavailableException({
        code: 'SUPABASE_AUTH_NOT_CONFIGURED',
        message:
          'Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    return { url, anonKey, serviceRoleKey };
  }

  private async requireUser(accessToken: string): Promise<User> {
    const { data, error } = await this.anon.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Token de acceso inválido o expirado.',
      });
    }
    return data.user;
  }

  private async loadActiveMembership(user: User): Promise<AuthenticatedMembership> {
    const membership = await this.findActiveMembership(user.id);
    if (!membership) {
      throw new ForbiddenException({
        code: 'NO_ACTIVE_MEMBERSHIP',
        message: 'El usuario no tiene membresía activa en ninguna clínica.',
      });
    }

    return {
      tenantId: membership.tenantId,
      role: membership.role,
      authUserId: user.id,
      membershipId: membership.id,
      fullName: membership.fullName,
      email: user.email,
      locationIds: membership.locationIds,
    };
  }

  private async findActiveMembership(authUserId: string) {
    const { data, error } = await this.admin
      .from('tenant_memberships')
      .select('id, tenant_id, role, full_name')
      .eq('auth_user_id', authUserId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOOKUP_FAILED',
        message: error.message,
      });
    }

    if (!data) return null;

    const locationIds = await this.listMembershipLocationIds(data.id as string);

    return {
      id: data.id as string,
      tenantId: data.tenant_id as string,
      role: data.role as TenantRole,
      fullName: data.full_name as string,
      locationIds,
    };
  }

  async listMembers(actor: AuthenticatedMembership) {
    assertTeamManager(actor);
    const { data, error } = await this.admin
      .from('tenant_memberships')
      .select('id, full_name, role, is_active, auth_user_id, created_at')
      .eq('tenant_id', actor.tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new ServiceUnavailableException({
        code: 'TEAM_LIST_FAILED',
        message: error.message,
      });
    }

    const rows = data ?? [];
    const emails = await Promise.all(
      rows.map(async (row) => {
        const { data: user } = await this.admin.auth.admin.getUserById(
          row.auth_user_id as string,
        );
        return [row.id as string, user.user?.email ?? null] as const;
      }),
    );
    const emailByMembershipId = Object.fromEntries(emails);
    const locationIdsByMembership = await this.listLocationIdsByMembership(
      actor.tenantId,
      rows.map((row) => row.id as string),
    );

    return rows.map((row) => ({
      id: row.id as string,
      fullName: row.full_name as string,
      role: row.role as TenantRole,
      isActive: row.is_active as boolean,
      email: emailByMembershipId[row.id as string],
      locationIds: locationIdsByMembership.get(row.id as string) ?? [],
      isSelf: row.id === actor.membershipId,
    }));
  }

  async inviteMember(actor: AuthenticatedMembership, input: InviteMember) {
    assertTeamManager(actor);

    const email = input.email.trim().toLowerCase();
    const { user, temporaryPassword } = await this.ensureAuthUser(
      email,
      input.fullName,
    );

    const existing = await this.findMembershipByAuthUser(user.id);
    if (existing) {
      if (existing.tenantId === actor.tenantId) {
        throw new ConflictException({
          code: 'MEMBER_ALREADY_IN_CLINIC',
          message: 'Esa persona ya está en el equipo de esta clínica.',
        });
      }
      throw new ConflictException({
        code: 'MEMBER_IN_OTHER_CLINIC',
        message: 'Ese correo ya pertenece a otra clínica.',
      });
    }

    const { data: membership, error } = await this.admin
      .from('tenant_memberships')
      .insert({
        tenant_id: actor.tenantId,
        auth_user_id: user.id,
        full_name: input.fullName.trim(),
        role: input.role,
        is_active: true,
      })
      .select('id, full_name, role, is_active')
      .single();

    if (error || !membership) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_CREATE_FAILED',
        message: error?.message ?? 'No se pudo agregar al equipo.',
      });
    }

    try {
      await this.replaceMembershipLocations(
        actor.tenantId,
        membership.id as string,
        input.locationIds,
      );
    } catch (linkError) {
      await this.admin.from('tenant_memberships').delete().eq('id', membership.id);
      throw linkError;
    }

    await this.admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        tenant_id: actor.tenantId,
        role: input.role,
        membership_id: membership.id,
      },
    });

    return {
      id: membership.id as string,
      fullName: membership.full_name as string,
      role: membership.role as TenantRole,
      isActive: membership.is_active as boolean,
      email,
      locationIds: input.locationIds,
      temporaryPassword,
    };
  }

  async updateMember(
    actor: AuthenticatedMembership,
    membershipId: string,
    input: UpdateMember,
  ) {
    assertTeamManager(actor);
    const target = await this.requireTenantMembership(actor.tenantId, membershipId);

    if (target.id === actor.membershipId && input.role && input.role !== actor.role) {
      throw new BadRequestException({
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'No puedes cambiar tu propio rol.',
      });
    }
    if (target.id === actor.membershipId && input.isActive === false) {
      throw new BadRequestException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'No puedes desactivar tu propia cuenta.',
      });
    }
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenException({
        code: 'CANNOT_MODIFY_OWNER',
        message: 'Solo el dueño puede modificar a otro dueño.',
      });
    }
    if (input.isActive === false && target.role === 'OWNER') {
      const owners = await this.countActiveOwners(actor.tenantId);
      if (owners <= 1) {
        throw new BadRequestException({
          code: 'LAST_OWNER',
          message: 'Debe quedar al menos un dueño activo.',
        });
      }
    }

    const { data, error } = await this.admin
      .from('tenant_memberships')
      .update({
        ...(input.fullName !== undefined ? { full_name: input.fullName.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .eq('tenant_id', actor.tenantId)
      .select('id, full_name, role, is_active, auth_user_id')
      .single();

    if (error || !data) {
      throw new ServiceUnavailableException({
        code: 'MEMBER_UPDATE_FAILED',
        message: error?.message ?? 'No se pudo actualizar el miembro.',
      });
    }

    const nextRole = data.role as TenantRole;
    if (input.locationIds) {
      await this.replaceMembershipLocations(
        actor.tenantId,
        membershipId,
        input.locationIds,
      );
    }
    await this.admin.auth.admin.updateUserById(data.auth_user_id as string, {
      app_metadata: data.is_active
        ? {
            tenant_id: actor.tenantId,
            role: nextRole,
            membership_id: data.id,
          }
        : { tenant_id: null, role: null, membership_id: null },
    });

    return {
      id: data.id as string,
      fullName: data.full_name as string,
      role: nextRole,
      isActive: data.is_active as boolean,
      locationIds:
        input.locationIds ?? (await this.listMembershipLocationIds(membershipId)),
    };
  }

  private async ensureAuthUser(email: string, fullName: string) {
    const existing = await this.findAuthUserByEmail(email);
    if (existing) {
      return { user: existing, temporaryPassword: null as string | null };
    }

    const invited = await this.admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (!invited.error && invited.data.user) {
      return { user: invited.data.user, temporaryPassword: null as string | null };
    }

    const afterInvite = await this.findAuthUserByEmail(email);
    if (afterInvite) {
      return { user: afterInvite, temporaryPassword: null as string | null };
    }

    const temporaryPassword = `Ae-${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}9!`;
    const created = await this.admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) {
      throw new ServiceUnavailableException({
        code: 'AUTH_USER_CREATE_FAILED',
        message:
          created.error?.message ??
          invited.error?.message ??
          'No se pudo crear el usuario.',
      });
    }
    return { user: created.data.user, temporaryPassword };
  }

  private async findAuthUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) {
      throw new ServiceUnavailableException({
        code: 'AUTH_USER_LOOKUP_FAILED',
        message: error.message,
      });
    }
    return data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
  }

  private async findMembershipByAuthUser(authUserId: string) {
    const { data, error } = await this.admin
      .from('tenant_memberships')
      .select('id, tenant_id, role, is_active')
      .eq('auth_user_id', authUserId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOOKUP_FAILED',
        message: error.message,
      });
    }
    if (!data) return null;
    return {
      id: data.id as string,
      tenantId: data.tenant_id as string,
      role: data.role as TenantRole,
    };
  }

  private async requireTenantMembership(tenantId: string, membershipId: string) {
    const { data, error } = await this.admin
      .from('tenant_memberships')
      .select('id, tenant_id, role, is_active, auth_user_id, full_name')
      .eq('id', membershipId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOOKUP_FAILED',
        message: error.message,
      });
    }
    if (!data) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Miembro no encontrado.',
      });
    }
    return {
      id: data.id as string,
      tenantId: data.tenant_id as string,
      role: data.role as TenantRole,
      isActive: data.is_active as boolean,
      authUserId: data.auth_user_id as string,
      fullName: data.full_name as string,
    };
  }

  private async countActiveOwners(tenantId: string) {
    const { count, error } = await this.admin
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'OWNER')
      .eq('is_active', true);
    if (error) {
      throw new ServiceUnavailableException({
        code: 'OWNER_COUNT_FAILED',
        message: error.message,
      });
    }
    return count ?? 0;
  }

  private async listMembershipLocationIds(membershipId: string) {
    const { data, error } = await this.admin
      .from('membership_locations')
      .select('location_id')
      .eq('membership_id', membershipId);
    if (error) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOCATIONS_FAILED',
        message: error.message,
      });
    }
    return (data ?? []).map((row) => row.location_id as string);
  }

  private async listLocationIdsByMembership(tenantId: string, membershipIds: string[]) {
    const map = new Map<string, string[]>();
    if (membershipIds.length === 0) return map;
    const { data, error } = await this.admin
      .from('membership_locations')
      .select('membership_id, location_id')
      .eq('tenant_id', tenantId)
      .in('membership_id', membershipIds);
    if (error) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOCATIONS_FAILED',
        message: error.message,
      });
    }
    for (const row of data ?? []) {
      const membershipId = row.membership_id as string;
      const current = map.get(membershipId) ?? [];
      current.push(row.location_id as string);
      map.set(membershipId, current);
    }
    return map;
  }

  private async replaceMembershipLocations(
    tenantId: string,
    membershipId: string,
    locationIds: string[],
  ) {
    const uniqueIds = [...new Set(locationIds)];
    const { data: locations, error: locationError } = await this.admin
      .from('locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id', uniqueIds);
    if (locationError) {
      throw new ServiceUnavailableException({
        code: 'LOCATION_LOOKUP_FAILED',
        message: locationError.message,
      });
    }
    if ((locations ?? []).length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'LOCATION_NOT_IN_CLINIC',
        message: 'Una o más sedes no pertenecen a esta clínica.',
      });
    }

    const { error: deleteError } = await this.admin
      .from('membership_locations')
      .delete()
      .eq('membership_id', membershipId)
      .eq('tenant_id', tenantId);
    if (deleteError) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOCATION_FAILED',
        message: deleteError.message,
      });
    }

    if (uniqueIds.length === 0) return;

    const { error: insertError } = await this.admin.from('membership_locations').insert(
      uniqueIds.map((locationId) => ({
        tenant_id: tenantId,
        membership_id: membershipId,
        location_id: locationId,
      })),
    );
    if (insertError) {
      throw new ServiceUnavailableException({
        code: 'MEMBERSHIP_LOCATION_FAILED',
        message: insertError.message,
      });
    }
  }
}
