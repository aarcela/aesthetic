/** Shared clinic UI labels (es-VE). */

export const PAYMENT_METHODS = [
  { value: 'ZELLE', label: 'Zelle (USD)' },
  { value: 'PAGO_MOVIL', label: 'Pago móvil (VES)' },
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'CASH_VES', label: 'Efectivo VES' },
  { value: 'BINANCE_USDT', label: 'USDT / Binance' },
  { value: 'POS_VES', label: 'Punto de venta (VES)' },
] as const;

export type PaymentMethod = string;

export type ClinicPaymentMethod = {
  id: string;
  code: string;
  label: string;
  nativeCurrency: 'USD' | 'VES' | 'USDT';
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
};

export const VES_METHODS = ['CASH_VES', 'PAGO_MOVIL', 'POS_VES'] as const;

export function isVesCurrency(currency: string): boolean {
  return currency === 'VES';
}

export function paymentLabel(
  method: string,
  catalog?: Array<{ code: string; label: string }>,
): string {
  const fromCatalog = catalog?.find((m) => m.code === method)?.label;
  if (fromCatalog) return fromCatalog;
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'Agendada',
    CONFIRMED: 'Confirmada',
    CHECKED_IN: 'En sala',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW: 'No asistió',
    DRAFT: 'Borrador',
    POSTED: 'Posteada',
    VOID: 'Anulada',
    PENDING: 'Pendiente',
    SENT: 'Enviado',
    FAILED: 'Fallido',
  };
  return map[status] ?? status;
}

export function isAttendedVisit(status: string): boolean {
  return status === 'COMPLETED';
}

export function canMarkAttendance(status: string): boolean {
  return status === 'SCHEDULED' || status === 'CONFIRMED';
}

export const INVENTORY_KINDS = [
  { value: 'MATERIAL', label: 'Material de visita' },
  { value: 'RETAIL', label: 'Producto para venta' },
] as const;

export type InventoryItemKind = (typeof INVENTORY_KINDS)[number]['value'];

export function inventoryKindLabel(kind?: string | null): string {
  if (kind === 'RETAIL') return 'Producto para venta';
  return 'Material de visita';
}

export function formatUsd(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatQty(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '0';
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 4 }).format(n);
}

export function formatPackage(
  capacity: string | number,
  unitOfMeasure: string,
): string {
  return `${formatQty(capacity)} ${unitOfMeasure}`.trim();
}
