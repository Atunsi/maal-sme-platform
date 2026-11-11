// The only module that talks to the Python API. `server-only` makes a client import a build error,
// so MAAL_API_KEY cannot reach the browser. Nothing here throws: every call resolves to an
// ApiResult, so a failing lens renders its own error and never takes a sibling card down.
import "server-only";

import type { z } from "zod";
import {
  AnomalyResponse,
  BusinessesResponse,
  CreditResponse,
  ForecastResponse,
  HealthResponse,
  ProfileResponse,
  ScenarioCatalog,
  ScenarioObject,
  ZakatResponse,
} from "@/lib/schemas";
import { BUSINESS_DATA_MS, REFERENCE_DATA_MS, RETRY_AFTER_DEFAULT_MS, RETRY_AFTER_MAX_MS } from "@/lib/cache-lifetimes";
import { apiLayer, cacheKey, retryDelayMs, type Scope } from "@/lib/request-layer";
import { STATIC, staticBusinesses, staticJson } from "@/lib/static-data";
import type { ApiErrorKind, ApiResult } from "@/lib/types";

const STATUS_KIND: Record<number, ApiErrorKind> = { 401: "unauthorized", 404: "not_found", 422: "invalid", 429: "rate_limited", 503: "unavailable" };

// One API request at a time, across all visitors to this server. This works around a bug in
// api/store.py: ServingStore shares one DuckDB connection between request threads, so parallel calls
// fail with HTTP 500 or, worse, return HTTP 200 computed from another request's rows (DECISIONS 41).
// Remove this queue once api/store.py is fixed, and the five requests run in parallel as §8 intends.
let queueTail: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(task, task);
  queueTail = run;
  return run;
}

// FX3 (DECISIONS 62): every read goes through the shared request layer (lib/request-layer.ts) and then the queue.
// The same read asked twice at once is one upstream call; a good answer is kept in this process's memory for
// `lifetimeMs`; the key holds the route, the role and the locale. Errors are never kept. The snapshot build reads
// files, so it skips the layer.
const layer = apiLayer;

function get<S extends z.ZodType>(path: string, schema: S, lifetimeMs: number, scope?: Scope): Promise<ApiResult<z.output<S>>> {
  if (STATIC) return oneAtATime(() => request(path, schema));
  return layer.shared(
    cacheKey(path, scope),
    lifetimeMs,
    () => oneAtATime(() => request(path, schema)),
    (result) => result.ok && lifetimeMs > 0,
  );
}

/** A POST goes through the same queue: the store bug does not care about the method. */
function post<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<ApiResult<z.output<S>>> {
  return oneAtATime(() => request(path, schema, body));
}

/** The online demo snapshot (lib/static-data.ts): the captured response, checked by the same schema. */
function fromSnapshot<S extends z.ZodType>(path: string, schema: S, body?: unknown): ApiResult<z.output<S>> {
  if (body !== undefined) return { ok: false, kind: "unavailable", detail: "The online demo is a snapshot; this needs the live engine." };
  let json: unknown;
  if (path.startsWith("/businesses")) {
    // The list over the captured businesses only, filtered and paged as the API would.
    const q = new URLSearchParams(path.split("?")[1] ?? "");
    const offset = Number(q.get("offset") ?? 0);
    const limit = Number(q.get("limit") ?? 25);
    const rows = staticBusinesses().filter((b) => (!q.get("sector") || b.sector === q.get("sector")) && (!q.get("q") || String(b.business_id).startsWith(q.get("q")!)));
    json = { population: "serving", data_source: "synthetic", total: rows.length, offset, limit, businesses: rows.slice(offset, offset + limit) };
  } else {
    json = staticJson(path);
    if (json === undefined) return { ok: false, kind: "not_found" };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, kind: "contract", detail: `snapshot ${path}` };
}

async function request<S extends z.ZodType>(path: string, schema: S, body?: unknown): Promise<ApiResult<z.output<S>>> {
  if (STATIC) return fromSnapshot(path, schema, body);
  const url = process.env.MAAL_API_URL;
  const key = process.env.MAAL_API_KEY;
  if (!url || !key) return { ok: false, kind: "config" };

  // Next's own fetch cache stays off: the request layer above decides what is kept, and for how long.
  const send = () =>
    fetch(url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? { "X-API-Key": key } : { "X-API-Key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 429 && body === undefined) {
      // FX3: on a 429, wait for the time the API states (1 s if it states none) and try once more. Never a loop:
      // a second 429 falls through to the page's own error state.
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(res.headers.get("retry-after"), RETRY_AFTER_DEFAULT_MS, RETRY_AFTER_MAX_MS)));
      res = await send();
    }
  } catch {
    return { ok: false, kind: "network" };
  }
  if (!res.ok) {
    // A 422 or 503 carries the API's own reason, shown verbatim (U4); other errors show the status only.
    const reason = res.status === 422 || res.status === 503 ? await res.json().then((b: { detail?: unknown }) => b?.detail, () => undefined) : undefined;
    return { ok: false, kind: STATUS_KIND[res.status] ?? "server", detail: typeof reason === "string" ? reason : `HTTP ${res.status}` };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, kind: "contract", detail: "response is not JSON" };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  return { ok: false, kind: "contract", detail: issues.join("; ") };
}

export type { Scope } from "@/lib/request-layer";

// The health line is never kept (lifetime 0): it must say what the API says now.
export const getHealth = () => get("/health", HealthResponse, 0);
export const getProfile = (id: number, scope?: Scope) => get(`/profile/${id}`, ProfileResponse, BUSINESS_DATA_MS, scope);
export const getCredit = (id: number, scope?: Scope) => get(`/lenses/credit?business_id=${id}`, CreditResponse, BUSINESS_DATA_MS, scope);
export const getForecast = (id: number, scope?: Scope) => get(`/lenses/forecast?business_id=${id}`, ForecastResponse, BUSINESS_DATA_MS, scope);
export const getAnomaly = (id: number, scope?: Scope) => get(`/lenses/anomaly?business_id=${id}`, AnomalyResponse, BUSINESS_DATA_MS, scope);
export const getZakat = (id: number, scope?: Scope) => get(`/lenses/zakat?business_id=${id}`, ZakatResponse, BUSINESS_DATA_MS, scope);

// DECISIONS 44 routes, through the same queue.
export type BusinessQuery = { offset: number; limit: number; sector?: string; q?: string };
export const getBusinesses = ({ offset, limit, sector, q }: BusinessQuery, scope?: Scope) => {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (sector) params.set("sector", sector);
  if (q) params.set("q", q);
  return get(`/businesses?${params}`, BusinessesResponse, REFERENCE_DATA_MS, scope);
};
export const getScenarioCatalog = (scope?: Scope) => get("/scenarios", ScenarioCatalog, REFERENCE_DATA_MS, scope);
export type Shock = { type: string; params: Record<string, number> };
export const runCustomScenario = (shocks: Shock[]) => post("/scenarios/run", { shocks }, ScenarioObject);
