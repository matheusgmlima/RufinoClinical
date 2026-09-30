// Dates shown to people are always in São Paulo time; the server runs in UTC.
const zone = { timeZone: "America/Sao_Paulo" } as const;

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  ...zone,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dayMonthFormat = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit" });
const longDateFormat = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "short", year: "numeric" });

/** "30/09, 14:05" */
export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value));
/** "30/09" */
export const formatDayMonth = (value: string | Date) => dayMonthFormat.format(new Date(value));
/** "30 de set. de 2026" */
export const formatLongDate = (value: string | Date) => longDateFormat.format(new Date(value));

/** First instant of the current month in São Paulo (UTC-3, no daylight saving since 2019), as ISO. */
export function startOfMonthInSaoPaulo(now = new Date()): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { ...zone, year: "numeric", month: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 3)).toISOString();
}

const DATE_FIELD = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateFieldFormat = new Intl.DateTimeFormat("en-CA", { ...zone, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Instant a São Paulo calendar day (a date field value, "2026-10-01") starts, as ISO. With
 * `dayAfter`, the start of the following day: the exclusive end of a period that includes it.
 * Null for anything that is not a real date.
 */
export function saoPauloDay(date: string, { dayAfter = false } = {}): string | null {
  const match = DATE_FIELD.exec(date);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 3));
  if (start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null;
  if (dayAfter) start.setUTCDate(start.getUTCDate() + 1);
  return start.toISOString();
}

/** São Paulo calendar day of an instant, as a date field value ("2026-10-01"). */
export const toDateField = (value: string | Date) => dateFieldFormat.format(new Date(value));
