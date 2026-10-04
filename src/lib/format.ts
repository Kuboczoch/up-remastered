const IEC_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

export type ByteUnit = (typeof IEC_UNITS)[number];

const BYTE_MULTIPLIERS: Record<ByteUnit, number> = {
  B: 1,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
};

export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new RangeError("Bytes must be a non-negative safe integer.");
  }

  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < IEC_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const maximumFractionDigits = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)} ${IEC_UNITS[unitIndex]}`;
}

export function parseByteQuantity(
  value: string,
  unit: ByteUnit,
  maxBytes = Number.MAX_SAFE_INTEGER,
): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    throw new RangeError("Enter a positive size without exponents.");
  }

  const bytes = Number(value) * BYTE_MULTIPLIERS[unit];
  if (!Number.isSafeInteger(bytes)) {
    throw new RangeError("Size must convert to a whole number of bytes.");
  }

  if (bytes < 1 || bytes > Math.min(maxBytes, Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `Size must be between 1 byte and ${formatBytes(maxBytes)}.`,
    );
  }

  return bytes;
}

export function formatRelativeExpiry(
  expiresAt: string | number | Date,
  now: string | number | Date = Date.now(),
  locale?: string,
): string {
  const difference = new Date(expiresAt).getTime() - new Date(now).getTime();
  if (!Number.isFinite(difference)) {
    throw new RangeError("Expiration must be a valid date.");
  }
  if (difference <= 0) return locale?.startsWith("pl") ? "wygasło" : "expired";

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });

  if (difference < hour)
    return relative.format(Math.ceil(difference / minute), "minute");
  if (difference < day)
    return relative.format(Math.ceil(difference / hour), "hour");
  return relative.format(Math.ceil(difference / day), "day");
}

export function formatLocalDateTime(
  value: string | number | Date,
  locale?: string,
  timeZone?: string,
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("Date must be valid.");
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}
