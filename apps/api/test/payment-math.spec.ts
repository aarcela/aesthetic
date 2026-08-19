import { describe, expect, it } from 'vitest';

import {
  paymentsMatchSaleTotal,
  usdEquivalent,
} from '../src/pos/payment-math.js';
import { slugCode } from '../src/settings/settings.service.js';

describe('payment-math', () => {
  it('converts VES legs with the selected FX snapshot', () => {
    expect(
      usdEquivalent({
        nativeCurrency: 'VES',
        amountNative: 200,
        fxRateVesPerUsd: 100,
      }),
    ).toBe(2);
  });

  it('treats USDT and USD methods as face-value USD', () => {
    expect(
      usdEquivalent({
        nativeCurrency: 'USDT',
        amountNative: 40,
        fxRateVesPerUsd: 100,
      }),
    ).toBe(40);
    expect(
      usdEquivalent({
        nativeCurrency: 'USD',
        amountNative: 60,
        fxRateVesPerUsd: 100,
      }),
    ).toBe(60);
  });

  it('accepts split payments within 0.01 USD tolerance', () => {
    expect(paymentsMatchSaleTotal(100, [60, 40])).toBe(true);
    expect(paymentsMatchSaleTotal(100, [60, 39.995])).toBe(true);
    expect(paymentsMatchSaleTotal(100, [60, 39.98])).toBe(false);
  });
});

describe('payment method codes', () => {
  it('builds a stable uppercase code from the label and currency', () => {
    expect(slugCode('Transferencia Bs.', 'VES')).toBe('TRANSFERENCIA_BS_VES');
    expect(slugCode('Zelle clínica', 'USD')).toBe('ZELLE_CLINICA_USD');
  });
});
