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
