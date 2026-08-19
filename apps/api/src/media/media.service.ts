import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { and, desc, eq } from 'drizzle-orm';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { digitalConsents, patientPhotos } from '../database/schema.js';
import { TenantDb } from '../database/tenant-db.js';

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET ?? 'patient-media';

@Injectable()
export class MediaService {
  constructor(@Inject(TenantDb) private readonly tenantDb: TenantDb) {}

  listPhotos(tenantId: string, patientId: string) {
    return this.tenantDb.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(patientPhotos)
        .where(
          and(
            eq(patientPhotos.tenantId, tenantId),
            eq(patientPhotos.patientId, patientId),
          ),
        )
        .orderBy(desc(patientPhotos.createdAt)),
    );
  }

  async createPhotoUpload(
    membership: AuthenticatedMembership,
    input: {
      patientId: string;
      appointmentId?: string;
      photoType: 'BEFORE' | 'AFTER' | 'OTHER';
      fileName: string;
      notes?: string;
    },
  ) {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${membership.tenantId}/${input.patientId}/${crypto.randomUUID()}-${safeName}`;

    const uploadUrl = await this.signUpload(storagePath);

    const row = await this.tenantDb.withTenant(membership.tenantId, async (tx) => {
      const [photo] = await tx
        .insert(patientPhotos)
        .values({
          tenantId: membership.tenantId,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          photoType: input.photoType,
          storagePath,
          notes: input.notes,
          createdBy: membership.membershipId,
        })
        .returning();
      return photo;
    });

    return { photo: row, uploadUrl, bucket: BUCKET };
  }

  async createConsentUpload(
    membership: AuthenticatedMembership,
    input: {
      patientId: string;
      appointmentId?: string;
      procedureName: string;
      fileName: string;
    },
  ) {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${membership.tenantId}/${input.patientId}/consents/${crypto.randomUUID()}-${safeName}`;
    const uploadUrl = await this.signUpload(storagePath);

    const row = await this.tenantDb.withTenant(membership.tenantId, async (tx) => {
      const [consent] = await tx
        .insert(digitalConsents)
        .values({
          tenantId: membership.tenantId,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          procedureName: input.procedureName,
          signatureStoragePath: storagePath,
          createdBy: membership.membershipId,
        })
        .returning();
      return consent;
    });

    return { consent: row, uploadUrl, bucket: BUCKET };
  }

  listConsents(tenantId: string, patientId: string) {
    return this.tenantDb.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(digitalConsents)
        .where(
          and(
            eq(digitalConsents.tenantId, tenantId),
            eq(digitalConsents.patientId, patientId),
          ),
        )
        .orderBy(desc(digitalConsents.signedAt)),
    );
  }

  private async signUpload(path: string): Promise<string> {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new ServiceUnavailableException({
        code: 'SUPABASE_STORAGE_NOT_CONFIGURED',
        message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
      });
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException({
        code: 'SIGNED_UPLOAD_FAILED',
        message:
          error?.message ??
          `Create private bucket "${BUCKET}" in Supabase Storage first.`,
      });
    }
    return data.signedUrl;
  }

  async signDownload(path: string, expiresIn = 3600): Promise<string | null> {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) return null;

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }
}
