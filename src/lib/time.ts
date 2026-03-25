export const APP_TIME_ZONE = "Europe/Sofia";

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const offsetValue =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = offsetValue.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const [, sign, hourPart, minutePart = "00"] = match;
  const totalMinutes = Number(hourPart) * 60 + Number(minutePart);
  return sign === "-" ? -totalMinutes : totalMinutes;
}

function getDatePartsInTimeZone(
  date: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function zonedMidnightToUtc(params: {
  year: number;
  month: number;
  day: number;
  timeZone: string;
}): Date {
  const { year, month, day, timeZone } = params;
  const assumedUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstOffsetMinutes = getTimeZoneOffsetMinutes(
    new Date(assumedUtcMs),
    timeZone
  );
  const firstPassMs = assumedUtcMs - firstOffsetMinutes * 60 * 1000;
  const correctedOffsetMinutes = getTimeZoneOffsetMinutes(
    new Date(firstPassMs),
    timeZone
  );
  return new Date(assumedUtcMs - correctedOffsetMinutes * 60 * 1000);
}

export function getPreviousCalendarDayRange(
  now: Date = new Date(),
  timeZone = APP_TIME_ZONE
): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  startUnix: number;
  endUnix: number;
} {
  const todayParts = getDatePartsInTimeZone(now, timeZone);
  const todayStart = zonedMidnightToUtc({ ...todayParts, timeZone });
  const previousDayProbe = new Date(todayStart.getTime() - 12 * 60 * 60 * 1000);
  const previousDayParts = getDatePartsInTimeZone(previousDayProbe, timeZone);
  const previousDayStart = zonedMidnightToUtc({
    ...previousDayParts,
    timeZone,
  });

  return {
    start: previousDayStart,
    end: todayStart,
    startIso: previousDayStart.toISOString(),
    endIso: todayStart.toISOString(),
    startUnix: Math.floor(previousDayStart.getTime() / 1000),
    endUnix: Math.floor(todayStart.getTime() / 1000),
  };
}
