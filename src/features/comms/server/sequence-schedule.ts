type SendingWindow = { days?: number[]; start?: string; end?: string };

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdays[values.weekday] ?? 0, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

function clockMinutes(value: string | undefined, fallback: number) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return fallback;
  return hour * 60 + minute;
}

export function isInsideSendingWindow(date: Date, timezone: string, window: SendingWindow) {
  const { weekday, minutes } = zonedParts(date, timezone);
  const days = Array.isArray(window.days) && window.days.length ? window.days : [1, 2, 3, 4, 5];
  const start = clockMinutes(window.start, 9 * 60);
  const end = clockMinutes(window.end, 17 * 60);
  return days.includes(weekday) && minutes >= start && minutes < end;
}

export function nextSendingWindow(date: Date, timezone: string, window: SendingWindow) {
  if (isInsideSendingWindow(date, timezone, window)) return date;
  const candidate = new Date(date);
  candidate.setUTCSeconds(0, 0);
  for (let index = 0; index < 8 * 24 * 4; index += 1) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 15);
    if (isInsideSendingWindow(candidate, timezone, window)) return candidate;
  }
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}
