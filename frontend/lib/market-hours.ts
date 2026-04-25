export function isUsEquityMarketOpen(now: Date = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  if (weekday === "Sat" || weekday === "Sun") return false;

  const totalMinutes = hour * 60 + minute;
  const openMinutes = 9 * 60 + 30; // 09:30 ET
  const closeMinutes = 16 * 60; // 16:00 ET
  return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
}