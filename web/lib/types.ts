import type { z } from "zod";
import type {
  AnomalyResponse,
  CreditDetail,
  CreditExplanation,
  CreditResponse,
  ForecastBody,
  ForecastResponse,
  HealthResponse,
  ProfileResponse,
  Receipt,
  ShariaScreen,
  ZakatResponse,
} from "@/lib/schemas";

export type Receipt = z.infer<typeof Receipt>;
export type ShariaScreen = z.infer<typeof ShariaScreen>;
export type CreditExplanation = z.infer<typeof CreditExplanation>;
export type CreditDetail = z.infer<typeof CreditDetail>;
export type CreditResponse = z.infer<typeof CreditResponse>;
export type ForecastBody = z.infer<typeof ForecastBody>;
export type ForecastResponse = z.infer<typeof ForecastResponse>;
export type AnomalyResponse = z.infer<typeof AnomalyResponse>;
export type ZakatResponse = z.infer<typeof ZakatResponse>;
export type ProfileResponse = z.infer<typeof ProfileResponse>;
export type HealthResponse = z.infer<typeof HealthResponse>;

export type ApiErrorKind =
  | "config"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "server"
  | "network"
  | "contract";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; kind: ApiErrorKind; detail?: string };

export type Provenance = Pick<ProfileResponse, "population" | "data_source" | "as_of">;
