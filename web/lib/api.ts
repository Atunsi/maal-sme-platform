// The only module that talks to the Python API. `server-only` makes a client import a build error,
// so MAAL_API_KEY cannot reach the browser. Nothing here throws: every call resolves to an
// ApiResult, so a failing lens renders its own error and never takes a sibling card down.
import "server-only";

import type { z } from "zod";
import {
  AnomalyResponse,
  CreditResponse,
  ForecastResponse,
  HealthResponse,
  ProfileResponse,
  ZakatResponse,
} from "@/lib/schemas";
import type { ApiErrorKind, ApiResult } from "@/lib/types";

const STATUS_KIND: Record<number, ApiErrorKind> = { 401: "unauthorized", 404: "not_found", 429: "rate_limited" };

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

function get<S extends z.ZodType>(path: string, schema: S): Promise<ApiResult<z.output<S>>> {
  return oneAtATime(() => request(path, schema));
}

async function request<S extends z.ZodType>(path: string, schema: S): Promise<ApiResult<z.output<S>>> {
  const url = process.env.MAAL_API_URL;
  const key = process.env.MAAL_API_KEY;
  if (!url || !key) return { ok: false, kind: "config" };

  let res: Response;
  try {
    // The API computes every answer fresh and attaches a receipt, so nothing here is cached.
    res = await fetch(url + path, { headers: { "X-API-Key": key }, cache: "no-store" });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (!res.ok) return { ok: false, kind: STATUS_KIND[res.status] ?? "server", detail: `HTTP ${res.status}` };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, kind: "contract", detail: "response is not JSON" };
  }
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  return { ok: false, kind: "contract", detail: issues.join("; ") };
}

export const getHealth = () => get("/health", HealthResponse);
export const getProfile = (id: number) => get(`/profile/${id}`, ProfileResponse);
export const getCredit = (id: number) => get(`/lenses/credit?business_id=${id}`, CreditResponse);
export const getForecast = (id: number) => get(`/lenses/forecast?business_id=${id}`, ForecastResponse);
export const getAnomaly = (id: number) => get(`/lenses/anomaly?business_id=${id}`, AnomalyResponse);
export const getZakat = (id: number) => get(`/lenses/zakat?business_id=${id}`, ZakatResponse);
