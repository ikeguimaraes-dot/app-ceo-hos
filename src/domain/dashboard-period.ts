// Dashboard dates are civil dates in the KPH operating timezone, independent
// of the device timezone. A new month starts on the Home after its first day.
export function dashboardPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((value) => value.type === type)!.value);
  const yesterday = new Date(
    Date.UTC(part("year"), part("month") - 1, part("day") - 1),
  ).toISOString().slice(0, 10);
  return { yesterday, month: `${yesterday.slice(0, 7)}-01` };
}
