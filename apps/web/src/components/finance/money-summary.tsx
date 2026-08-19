'use client';

import { formatUsd } from '@/lib/clinic';

type Props = {
  entraUsd: string;
  saleUsd: string;
  netoUsd: string;
};

export function MoneySummary({ entraUsd, saleUsd, netoUsd }: Props) {
  const neto = Number(netoUsd);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="panel border-l-4 border-l-ok px-5 py-5">
        <p className="text-sm font-semibold text-muted">Entró</p>
        <p className="tabular mt-1 text-3xl font-semibold text-ok">{formatUsd(entraUsd)}</p>
        <p className="mt-1 text-sm text-muted">Dinero que llegó</p>
      </div>
      <div className="panel border-l-4 border-l-danger px-5 py-5">
        <p className="text-sm font-semibold text-muted">Salió</p>
        <p className="tabular mt-1 text-3xl font-semibold text-danger">
          {formatUsd(saleUsd)}
        </p>
        <p className="mt-1 text-sm text-muted">Dinero que se fue</p>
      </div>
      <div className="panel border-l-4 border-l-botanical px-5 py-5">
        <p className="text-sm font-semibold text-muted">Queda</p>
        <p
          className={`tabular mt-1 text-3xl font-semibold ${
            neto >= 0 ? 'text-botanical' : 'text-danger'
          }`}
        >
          {formatUsd(netoUsd)}
        </p>
        <p className="mt-1 text-sm text-muted">Entró − Salió</p>
      </div>
    </div>
  );
}
