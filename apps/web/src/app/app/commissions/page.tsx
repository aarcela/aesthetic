'use client';

import { useCallback, useState, useTransition } from 'react';

import {
  CommissionRuleCreateModal,
  type CommissionRuleCreatePayload,
} from '@/components/commissions/commission-rule-create-modal';
import { EmptyState, LiveMessage, PageHeader } from '@/components/ui';
import { formatUsd } from '@/lib/clinic';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTabRefresh } from '@/lib/use-tab-refresh';
import { canManageOperations } from '@aesthetic/shared';

type Rule = {
  id: string;
  ruleType: string;
  ratePercent: string | null;
  flatUsd: string | null;
  priority: number;
};

type Report = {
  totalCommissionUsd: string;
  entries: Array<{ id: string; commissionUsd: string; grossUsd: string }>;
};

export default function CommissionsPage() {
  const { token, membership } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [pending, startTransition] = useTransition();
  const canManage = membership ? canManageOperations(membership.role) : false;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const from = new Date();
      from.setDate(1);
      const to = new Date();
      const [r, rep] = await Promise.all([
        apiFetch<Rule[]>('/v1/commissions/rules', { token }),
        apiFetch<Report>(
          `/v1/commissions/report?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
          { token },
        ),
      ]);
      setRules(r);
      setReport(rep);
      setUpgrade(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PLAN_UPGRADE_REQUIRED') {
        setUpgrade(true);
      } else {
        setListError(err instanceof Error ? err.message : 'Error al cargar comisiones');
      }
    }
  }, [token]);

  useTabRefresh('/app/commissions', load, Boolean(token && membership?.tenantId));

  function onCreate(payload: CommissionRuleCreatePayload) {
    if (!token || !membership) return;
    setFormError(null);
    startTransition(async () => {
      try {
        await apiFetch('/v1/commissions/rules', {
          method: 'POST',
          token,
          body: JSON.stringify({
            specialistMembershipId: membership.membershipId,
            ruleType: 'PERCENT_NET_MATERIALS',
            ratePercent: payload.ratePercent,
            priority: 10,
          }),
        });
        setModalOpen(false);
        await load();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No se pudo crear la regla');
      }
    });
  }

  if (upgrade) {
    return (
      <div>
        <PageHeader title="Comisiones" subtitle="Disponible en plan Pro." />
        <EmptyState
          title="Plan Pro requerido"
          body="Las comisiones netas de material se calculan al postear ventas Pro."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Comisiones"
        subtitle="Lo que le corresponde a cada especialista según lo cobrado, descontando materiales."
        action={
          canManage ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError(null);
              setModalOpen(true);
            }}
          >
            Nueva regla
          </button>
          ) : null
        }
      />

      {listError ? <LiveMessage tone="danger">{listError}</LiveMessage> : null}

      <div className="panel mb-6 p-5">
        <p className="text-sm text-muted">Total del mes</p>
        <p className="tabular text-3xl font-semibold text-botanical">
          {formatUsd(report?.totalCommissionUsd ?? 0)}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rules.length === 0 ? (
          <EmptyState title="Sin reglas" body="Crea la primera con “Nueva regla”." />
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="panel px-4 py-3">
              <p className="font-semibold text-botanical">{rule.ruleType}</p>
              <p className="tabular text-sm text-muted">
                {rule.ratePercent ? `${rule.ratePercent}%` : formatUsd(rule.flatUsd ?? 0)} ·
                prioridad {rule.priority}
              </p>
            </div>
          ))
        )}
      </div>

      <CommissionRuleCreateModal
        open={modalOpen}
        pending={pending}
        error={formError}
        onClose={() => setModalOpen(false)}
        onSave={onCreate}
      />
    </div>
  );
}
