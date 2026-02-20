import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches ALL rows from a Supabase table, paginating automatically to avoid
 * the default 1000-row limit. Uses .range() in batches of 1000.
 *
 * @param table - The table name to query
 * @param select - The select string (e.g. "id, role" or "*")
 * @param filters - Optional callback to apply filters (.eq, .in, etc.)
 * @returns All matching rows
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  select: string,
  filters?: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(select);
    if (filters) {
      query = filters(query);
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allRows.push(...(data as T[]));
      from += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}
