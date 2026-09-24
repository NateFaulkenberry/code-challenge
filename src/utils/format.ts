const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear()
    ? shortDateFormatter.format(date)
    : dateFormatter.format(date);
}

export function formatDuration(ms: number): string {
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
