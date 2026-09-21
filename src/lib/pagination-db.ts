import { pageMeta, stableSort, type PageMeta, type Paging } from "./pagination";

/**
 * The one way a list asks the database for a page.
 *
 * The count, the skip and the limit all happen IN the query. Nothing is fetched
 * and sliced afterwards, so a page costs the same whether the collection holds a
 * hundred rows or a hundred thousand — the two things that DO grow with depth are
 * the skip and the count, and both are served by an index when the filter and
 * the sort have one (see the indexes on the models).
 *
 * The model is typed by what it can do rather than by Mongoose's class: the
 * models here are `models.X || model(...)`, whose union type Mongoose's own
 * signatures do not narrow.
 */
type Queryable = {
  find: (filter: Record<string, unknown>) => {
    select: (s: string) => unknown;
    sort: (s: Record<string, 1 | -1>) => {
      skip: (n: number) => { limit: (n: number) => { lean: () => Promise<unknown> } };
    };
  };
  countDocuments: (filter: Record<string, unknown>) => Promise<number>;
};

export type Paged<T> = { rows: T[]; meta: PageMeta };

export async function paginate<T = Record<string, unknown>>(
  model: unknown,
  filter: Record<string, unknown>,
  opts: { sort: Record<string, 1 | -1>; paging: Paging; select?: string }
): Promise<Paged<T>> {
  const m = model as Queryable;
  const sort = stableSort(opts.sort);
  const { page, pageSize } = opts.paging;

  const fetchPage = async (p: number): Promise<T[]> => {
    let query: unknown = m.find(filter);
    if (opts.select) query = (query as { select: (s: string) => unknown }).select(opts.select);
    return (await (query as ReturnType<Queryable["find"]>)
      .sort(sort)
      .skip((p - 1) * pageSize)
      .limit(pageSize)
      .lean()) as T[];
  };

  // Count and rows are independent, so they run together.
  const [total, rows] = await Promise.all([m.countDocuments(filter), fetchPage(page)]);
  const meta = pageMeta(total, page, pageSize);

  // Asked for a page past the end — a bookmark to page 9 after rows were removed.
  // Show the last real page instead of an empty table with a footer that says
  // "page 9 of 4". Only in this edge case does it cost a second query.
  if (rows.length === 0 && total > 0 && meta.page !== page) {
    return { rows: await fetchPage(meta.page), meta };
  }

  return { rows, meta };
}
