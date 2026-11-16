export async function readAllPages<T>(
  load: (from: number, to: number) => Promise<{ data: T[] | null; count: number | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ;) {
    const { data, count } = await load(from, from + 499);
    const page = data ?? [];
    if (count === null || (page.length === 0 && from < count)) {
      throw new Error('Die Daten konnten nicht vollständig geladen werden.');
    }
    rows.push(...page);
    from += page.length;
    if (from >= count) return rows;
  }
}
