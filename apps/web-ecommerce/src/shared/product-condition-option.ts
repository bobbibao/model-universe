// A SKU URL identifies the selected merchandise even when another combination has stock.
export function initialConditionOptionId(
  options: readonly { id: number; stock: number }[],
  routeOptionId: number,
  requestedOptionId: number | null,
): number {
  return (
    options.find((option) => option.id === requestedOptionId)?.id ??
    options.find((option) => option.id === routeOptionId)?.id ??
    options.find((option) => option.stock > 0)?.id ??
    options[0]?.id ??
    routeOptionId
  );
}

// Creation order is shared by every sibling URL; price, stock and selection never move a row.
export function orderConditionOptions<T extends { id: number }>(options: readonly T[]): T[] {
  return [...options].sort((a, b) => a.id - b.id);
}
