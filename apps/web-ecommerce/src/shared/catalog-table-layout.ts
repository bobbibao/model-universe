// Keep full desktop pages dense while using the entire available table body.
export function catalogTableLayout(bodyHeight: number) {
  if (!Number.isFinite(bodyHeight) || bodyHeight < 1) return null;
  const preferredRows = Math.ceil(bodyHeight / 64);
  const rowsAtMinimumHeight = Math.max(1, Math.floor(bodyHeight / 58));
  const pageSize = Math.max(1, Math.min(100, preferredRows, rowsAtMinimumHeight));
  return { pageSize, rowHeight: bodyHeight / pageSize };
}
