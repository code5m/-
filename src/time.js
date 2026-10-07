const ZH = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatChinaTime(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "未知";
  return ZH.format(d).replace(/\//g, "-");
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function zoneOffsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

function localTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0));
  const offset = zoneOffsetMs(guess, timeZone);
  guess = new Date(guess.getTime() - offset);
  const offset2 = zoneOffsetMs(guess, timeZone);
  if (offset2 !== offset) guess = new Date(guess.getTime() - (offset2 - offset));
  return guess;
}

const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

export function inferResetTime(text, createdAt) {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) return null;
  const t = String(text).toLowerCase();

  const relative = t.match(/\bin\s+(\d+)\s+(minute|minutes|hour|hours|day|days)\b/);
  if (relative) {
    const n = Number(relative[1]);
    const unit = relative[2];
    const ms = unit.startsWith("minute") ? n * 60000 : unit.startsWith("hour") ? n * 3600000 : n * 86400000;
    return new Date(base.getTime() + ms);
  }

  const clock = t.match(/\b(?:(tomorrow|today)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(pst|pdt|pt)?\b/);
  if (clock) {
    const [, dayWord, hh, mm="0", ampm, zone] = clock;
    let h = Number(hh) % 12 + (ampm === "pm" ? 12 : 0);
    const sourceZone = zone ? "America/Los_Angeles" : "UTC";
    const p = zonedParts(base, sourceZone);
    let y = +p.year, m = +p.month, d = +p.day;
    if (dayWord === "tomorrow") {
      const tmp = new Date(Date.UTC(y, m - 1, d + 1));
      y = tmp.getUTCFullYear(); m = tmp.getUTCMonth() + 1; d = tmp.getUTCDate();
    }
    return localTimeToUtc({ year:y, month:m, day:d, hour:h, minute:+mm }, sourceZone);
  }

  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp("\\b" + WEEKDAYS[i] + "\\b").test(t)) {
      const p = zonedParts(base, "America/Los_Angeles");
      const currentLocal = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
      const currentDow = currentLocal.getUTCDay();
      let delta = (i - currentDow + 7) % 7;
      if (delta === 0) delta = 7;
      const target = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + delta, 9, 0));
      return localTimeToUtc({
        year: target.getUTCFullYear(),
        month: target.getUTCMonth() + 1,
        day: target.getUTCDate(),
        hour: 9,
        minute: 0
      }, "America/Los_Angeles");
    }
  }

  return null;
}
