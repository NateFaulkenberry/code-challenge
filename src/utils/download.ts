/** Triggers a client-side download of JSON data (no server involved). */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function timestampedName(prefix: string, now = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.json`;
}
