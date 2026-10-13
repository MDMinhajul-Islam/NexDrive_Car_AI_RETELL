export type RawParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export type TableParams<S extends string> = {
  q: string;
  page: number;
  pageSize: number;
  sort: S;
  dir: "asc" | "desc";
};

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function oneOf<T extends readonly string[]>(value: string, allowed: T): T[number] | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : "";
}

export function isoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : "";
}

/** Validates the common list params. Anything malformed falls back to a default. */
export function parseTableParams<S extends string>(
  sp: RawParams,
  sortable: readonly S[],
  defaults: { sort: S; dir: "asc" | "desc"; pageSize?: number },
): TableParams<S> {
  const page = Number(first(sp.page));
  const size = Number(first(sp.pageSize));
  const sort = first(sp.sort) as S;
  const dir = first(sp.dir);
  return {
    q: first(sp.q).trim().slice(0, 80),
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : (defaults.pageSize ?? 25),
    sort: sortable.includes(sort) ? sort : defaults.sort,
    dir: dir === "asc" || dir === "desc" ? dir : defaults.dir,
  };
}

/** Removes characters that have meaning inside a PostgREST filter expression. */
export function sanitizeTerm(term: string) {
  return term.replace(/[^\p{L}\p{N}\s@.+-]/gu, " ").replace(/\s+/g, " ").trim();
}

export type Paged<T> = { rows: T[]; total: number; error: string | null };
