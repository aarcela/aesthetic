import { describe, expect, it } from 'vitest';

import { roundMoney } from '../src/pos/payment-math.js';

describe('commission net materials math', () => {
  it('computes percent of gross minus materials', () => {
    const gross = 200;
    const materials = 40;
    const rate = 30;
    const commission = roundMoney(((gross - materials) * rate) / 100);
    expect(commission).toBe(48);
  });
});
