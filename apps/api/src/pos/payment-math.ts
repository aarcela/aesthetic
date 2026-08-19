import type { FinanceNativeCurrency } from '@aesthetic/shared';

export type NativeCurrency = FinanceNativeCurrency;

/**
 * Converts a payment leg to USD using the immutable FX snapshot on the sale.
 * USDT is treated as face-value USD (1:1) because DolarApi has no USDT rate.
 */
export function usdEquivalent(input: {
  nativeCurrency: NativeCurrency;
  amountNative: number;
  fxRateVesPerUsd: number;
}): number {
  if (!(input.amountNative > 0)) {
    throw new Error('Payment amount must be positive.');
  }
  if (!(input.fxRateVesPerUsd > 0)) {
    throw new Error('FX rate must be positive.');
  }

  if (input.nativeCurrency === 'VES') {
    return roundMoney(input.amountNative / input.fxRateVesPerUsd);
  }

  return roundMoney(input.amountNative);
}

export function paymentsMatchSaleTotal(
  saleAmountUsd: number,
  paymentUsdEquivalents: number[],
  toleranceUsd = 0.01,
): boolean {
  const paid = roundMoney(
    paymentUsdEquivalents.reduce((sum, value) => sum + value, 0),
  );
  return Math.abs(roundMoney(saleAmountUsd) - paid) <= toleranceUsd;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
