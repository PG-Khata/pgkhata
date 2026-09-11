const API_URL = "/api/backend";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Performs the call and hands back the raw `Response`.
 *
 * Split out of `request` so that `getPage` can read the pagination headers.
 * `request` throws away everything but the parsed body, which is the right
 * default for the ~40 single-object calls but makes `X-Total-Count` and friends
 * unreachable for the list endpoints.
 */
async function send(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let body: { error?: string; details?: unknown } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body.error || `Request failed: ${res.status}`, body.details);
  }

  return res;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await send(path, options);

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** One page of a list endpoint, together with the paging state the API reported. */
export interface ApiPage<T> {
  rows: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  /**
   * Rows matching the filter before limit/offset, from `X-Total-Count`.
   *
   * `undefined` when the endpoint does not send the header. Callers must render
   * that absence honestly ("Page 3") rather than substituting a total they do
   * not have.
   */
  total?: number;
}

function numericHeader(res: Response, name: string): number | undefined {
  const raw = res.headers.get(name);
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * A `GET` whose response headers carry the paging state: `X-Page`,
 * `X-Page-Size`, `X-Has-More` and `X-Total-Count`.
 *
 * Deliberately additive rather than a change to `api.get`, whose callers all
 * expect the parsed body itself.
 *
 * The fallbacks matter: an endpoint that has not been paginated yet returns a
 * plain array with no headers, and this degrades to a single complete page
 * rather than to a broken pager.
 */
async function getPage<T>(path: string): Promise<ApiPage<T>> {
  const res = await send(path);
  const rows: T[] = res.status === 204 ? [] : await res.json();

  return {
    rows,
    page: numericHeader(res, "X-Page") ?? 1,
    pageSize: numericHeader(res, "X-Page-Size") ?? rows.length,
    hasMore: res.headers.get("X-Has-More") === "true",
    total: numericHeader(res, "X-Total-Count"),
  };
}

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Builds a query string, dropping absent and empty values so an untouched
 * filter never narrows the result.
 *
 * `false` is kept: the API's boolean filters are tri-state ("true" / "false" /
 * not sent), so dropping it would silently turn `voided=false` into "either".
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  getPage,

  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
