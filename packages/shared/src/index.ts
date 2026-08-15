import { z } from 'zod';

export const fxFuenteSchema = z.enum(['oficial', 'paralelo']);
export type FxFuente = z.infer<typeof fxFuenteSchema>;

export const dollarApiRateSchema = z.object({
  moneda: z.literal('USD'),
  fuente: fxFuenteSchema,
  nombre: z.string(),
  compra: z.number().nullable(),
  venta: z.number().nullable(),
  promedio: z.number().positive(),
  fechaActualizacion: z.string().datetime({ offset: true }),
});

export const dollarApiRatesSchema = z.array(dollarApiRateSchema);

export const updateFxSourceSchema = z.object({
  fuente: fxFuenteSchema,
});

export type UpdateFxSource = z.infer<typeof updateFxSourceSchema>;

export type FxRateSnapshot = {
  fuente: FxFuente;
  vesPerUsd: string;
  providerUpdatedAt: Date;
  fetchedAt: Date;
};
