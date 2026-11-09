const definitions = [
  { name: "Sydney", zone: "Australia/Sydney", country: "au", start: 8, end: 17 },
  { name: "Tokyo", zone: "Asia/Tokyo", country: "jp", start: 9, end: 18 },
  { name: "London", zone: "Europe/London", country: "gb", start: 8, end: 17 },
  { name: "New York", zone: "America/New_York", country: "us", start: 8, end: 17 },
];
export function marketSessions(now: number) {
  return definitions.map(d => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: d.zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const value = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    const hour = Number(value("hour")) + Number(value("minute")) / 60;
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(value("weekday"));
    const open = day < 5 && hour >= d.start && hour < d.end;
    let until = open ? d.end - hour : d.start - hour;
    if (!open && (until <= 0 || day >= 5)) {
      let days = 1;
      while ((day + days) % 7 >= 5) days++;
      until = days * 24 + d.start - hour;
    }
    return { ...d, open, hours: Math.max(1, Math.ceil(until)) };
  });
}