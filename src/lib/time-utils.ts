export function roundTimeTo10(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  let roundedMinute = Math.round(minute / 10) * 10;

  if (roundedMinute === 60) {
    hour = (hour + 1) % 24;
    roundedMinute = 0;
  }

  return `${String(hour).padStart(2, "0")}:${String(roundedMinute).padStart(2, "0")}`;
}
