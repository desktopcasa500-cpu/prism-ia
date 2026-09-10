export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function normalizeTimeZone(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate || candidate.length > 100) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function timeZoneOffsetMs(date, timeZone) {
  const local = getLocalParts(date, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - date.getTime();
}

export function localWallTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const zone = normalizeTimeZone(timeZone);
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(wallUtc - timeZoneOffsetMs(new Date(wallUtc), zone));
  const corrected = wallUtc - timeZoneOffsetMs(result, zone);
  if (corrected !== result.getTime()) result = new Date(corrected);
  return result;
}

export function startOfLocalDay(value = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const zone = normalizeTimeZone(timeZone);
  const local = getLocalParts(new Date(value), zone);
  return localWallTimeToUtc({ year: local.year, month: local.month, day: local.day }, zone);
}

export function startOfLocalWeek(value = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const zone = normalizeTimeZone(timeZone);
  const local = getLocalParts(new Date(value), zone);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const day = localDate.getUTCDay();
  localDate.setUTCDate(localDate.getUTCDate() - day);
  return localWallTimeToUtc({ year: localDate.getUTCFullYear(), month: localDate.getUTCMonth() + 1, day: localDate.getUTCDate() }, zone);
}

export function nextWeeklyReset(value = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const zone = normalizeTimeZone(timeZone);
  const local = getLocalParts(new Date(value), zone);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysUntilNextSunday = localDate.getUTCDay() === 0 ? 7 : 7 - localDate.getUTCDay();
  localDate.setUTCDate(localDate.getUTCDate() + daysUntilNextSunday);
  return localWallTimeToUtc({ year: localDate.getUTCFullYear(), month: localDate.getUTCMonth() + 1, day: localDate.getUTCDate() }, zone);
}
