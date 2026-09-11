export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function detectUserTimeZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.trim() ? zone.trim() : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
