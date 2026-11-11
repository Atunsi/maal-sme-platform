// Runtime validators for the five read-paths, written from responses captured in web/fixtures/.
// A backend change fails here with a clear message instead of rendering undefined.
//
// Several of the project's guarantees are enforced in this file, not in the components:
//   U1  `credit` is strict, so any added field (a stressed markup, say) is rejected, and
//       markup_fixed_at_inception can only be true.
//   U2  late_penalty_policy can only be "charity_directed".
//   U8  an anomaly flag is strict, so a score field is rejected.
//   U11 population can only be "serving"; a research business cannot reach the UI.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const Status = z.enum(["scored", "partial_profile", "insufficient_data"]);

export const Receipt = z.looseObject({
  schema_version: z.string(),
  config_sha256: sha256,
  lens_config_sha256: sha256,
  credit_model_version: z.string(),
  credit_model_sha256: sha256,
  credit_model_cv_auc: z.number(),
  credit_model_oracle_ceiling_auc: z.number(),
  reference_stats_sha256: sha256,
  sharia_rules_sha256: sha256,
  code_commit: z.string(),
  generated_by: z.string(),
  data_sha256: sha256,
  output_sha256: sha256,
  scope: z.string().min(1).optional(), // the four lens routes send it; /profile does not
  scope_ar: z.string().min(1).optional(), // DECISIONS 57
});

const header = {
  business_id: z.number().int(),
  population: z.literal("serving"),
  data_source: z.enum(["synthetic", "sandbox"]),
  sector: z.enum(["retail_trade", "food_beverage", "construction", "professional_services"]),
  as_of: isoDate,
  status: Status,
  coverage_days_90d: z.number().int().nullable(),
  lens_not_run_reason: z.literal("insufficient_data").optional(),
  partial_profile_unavailable_features: z.array(z.string()).optional(),
  receipt: Receipt,
};

// U13: every lens receipt must carry its scope, so its absence there is a contract failure.
const lensHeader = { ...header, receipt: Receipt.required({ scope: true }) };

/** §15: a null lens body is legal only as the explicit refusal, and the refusal must carry its reason. */
function refusalIsExplicit(body: unknown, r: { status: string; lens_not_run_reason?: string }): boolean {
  return r.status === "insufficient_data" ? body === null && r.lens_not_run_reason === "insufficient_data" : body !== null;
}

export const Credit = z.strictObject({
  decision: z.enum(["approved", "declined"]),
  amount_sar: z.number().nullable(),
  base_markup_pct: z.number().nullable(),
  adjusted_markup_pct: z.number().nullable(),
  markup_fixed_at_inception: z.literal(true),
  late_penalty_policy: z.literal("charity_directed"),
  repayment_months: z.number().int().nullable(),
  recourse: z.null(),
  stress: z.null(),
});

const FeatureId = z.union([z.number().int(), z.string()]); // the registry has ids such as "62b"

const PublicLine = z.object({
  feature_id: FeatureId.nullable(), // null on a compliance decline: the template is the only line
  text: z.string(),
  // DECISIONS 57: the backend's Arabic sibling of every template. Optional, so an older fixture or object
  // without it still parses and the UI falls back to the English with the pending label (1a.10).
  text_ar: z.string().nullable().optional(),
  magnitude: z.enum(["strongly", "moderately", "marginally"]).nullable(),
  direction: z.enum(["supports", "against", "either"]).nullable(),
  source: z.literal("compliance").optional(),
});

export const CreditExplanation = z.object({
  public_tier: z.array(PublicLine),
  compliance_tier: z.object({
    units: z.string(),
    units_ar: z.string().optional(),
    threshold_table: z.record(z.string(), z.string()),
    phrases: z.record(z.string(), z.string()),
    phrases_ar: z.record(z.string(), z.string()).optional(),
    feature_labels_ar: z.record(z.string(), z.string()).optional(),
    contributions: z.array(
      z.object({
        feature_id: FeatureId,
        feature: z.string(),
        contribution_logodds: z.number(),
        imputed: z.boolean(),
      }),
    ),
  }),
});

const ShariaStatus = z.enum(["compliant", "soft_flag_review", "hard_flag"]);

export const CreditDetail = z.object({
  decline_reason: z
    .enum(["risk_model", "affordability_no_installment_capacity", "affordability_below_minimum_amount", "sharia_hard_flag"])
    .nullable(),
  decline_origin: z.enum(["risk_model", "affordability", "compliance"]).nullable(),
  pd: z.number(),
  logit: z.number(),
  risk_tier: z.string().nullable(),
  model_version: z.string(),
  model_sha256: sha256,
  sharia_screen_status: ShariaStatus,
  offer_status: z.enum(["unconditional", "conditional_on_sharia_review"]).nullable(),
  risk_assessment_used_for_decision: z.boolean(),
  conditions: z.array(z.string()).optional(),
  conditions_ar: z.array(z.string()).optional(),
});

export const ShariaScreen = z.object({
  sharia_screen_status: ShariaStatus,
  evidence_basis: z.enum(["declared_mcc", "registered_sector"]),
  declared_mcc: z.union([z.string(), z.number()]).nullable(),
  rules_triggered: z.array(z.object({ rule_id: z.string(), severity: z.string(), detail: z.string(), detail_ar: z.string().optional() })),
  owner_prompts: z.array(z.string()),
  owner_prompts_ar: z.array(z.string()).optional(),
  disclosures: z.array(
    z.object({ disclosure_id: z.string(), detail: z.string(), prompt: z.string(), detail_ar: z.string().optional(), prompt_ar: z.string().optional() }),
  ),
  rule_table_version: z.string(),
  rule_table_sha256: sha256,
  rule_table_status: z.string(),
  deterministic: z.literal(true),
  compliance_explanation: z.string().nullable(),
  compliance_explanation_ar: z.string().nullable().optional(),
});

export const CreditResponse = z
  .object({
    ...lensHeader,
    credit: Credit.nullable(),
    credit_explanation: CreditExplanation.optional(),
    credit_decision_detail: CreditDetail.optional(),
    sharia_screen: ShariaScreen,
  })
  .refine((r) => refusalIsExplicit(r.credit, r), { message: "credit body and status disagree (§15)" });

const Horizon = z.object({
  horizon_days: z.number().int(),
  projected_net_flow_sar: z.number(),
  projected_balance_sar: z.number(),
  min_projected_balance_sar: z.number(),
});

export const ForecastBody = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("computed"),
    as_of: isoDate,
    balance_today_sar: z.number(),
    model: z.array(Horizon),
    naive_baseline: z.array(Horizon),
    crunch_alert: z.object({
      level: z.enum(["none", "watch", "crunch"]),
      days_to_projected_negative_balance: z.number().int().nullable(),
      liquidity_hazard: z.object({ "30d": z.number().nullable(), "60d": z.number().nullable(), "90d": z.number().nullable() }),
      drivers: z.array(z.string()),
      drivers_ar: z.array(z.string()).optional(),
    }),
    ramadan_adjusted: z.boolean().nullable(),
    method: z.string(),
    method_ar: z.string().optional(),
  }),
  z.object({ status: z.literal("not_computed"), reason: z.literal("insufficient_history"), history_days: z.number().int() }),
]);

export const ForecastResponse = z
  .object({ ...lensHeader, forecast: ForecastBody.nullable() })
  .refine((r) => refusalIsExplicit(r.forecast, r), { message: "forecast body and status disagree (§15)" });

export const AnomalyFlag = z.strictObject({
  transaction_id: z.number().int(),
  date: isoDate,
  hour: z.number().int(),
  direction: z.enum(["in", "out"]),
  amount_sar: z.number(),
  counterparty_type: z.string(),
  category: z.string(),
  flag_reason: z.enum([
    "repeat_payment",
    "amount_outlier",
    "new_counterparty_large_amount",
    "counterparty_both_directions",
    "unusual_hour",
    "rare_category",
    "multivariate_outlier",
  ]),
});

const AnomalyBody = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("computed"),
    scan_window: z.object({ from: isoDate, to: isoDate }),
    transactions_scanned: z.number().int(),
    flags: z.array(AnomalyFlag),
    method: z.string(),
    method_ar: z.string().optional(),
  }),
  z.strictObject({
    status: z.literal("not_computed"),
    reason: z.literal("too_few_transactions_for_a_baseline"),
    transactions_scanned: z.number().int(),
    flags: z.array(AnomalyFlag).max(0),
  }),
]);

// E11 (DECISIONS 51, 44): the review cap would ride here. It stopped at S9 (adding it changes the response's
// output_sha256), so the field is optional and the UI falls back to the count alone when it is absent.
const Limits = z.strictObject({ max_flags: z.number().int().positive() });

export const AnomalyResponse = z
  .object({ ...lensHeader, anomaly: AnomalyBody.nullable(), limits: Limits.optional() })
  .refine((r) => refusalIsExplicit(r.anomaly, r), { message: "anomaly body and status disagree (§15)" });

const ZakatBody = z.object({
  liability_sar: z.number().nullable(),
  nisab_value_sar: z.number(),
  nisab_basis: z.string(),
  nisab_basis_ar: z.string().optional(),
  nisab_source_status: z.string(),
  rate: z.number(),
  method: z.string(),
  hawl_rule: z.string(),
  deterministic: z.literal(true),
  status: z.enum(["computed", "zero_liability", "not_computed"]),
  reason: z.enum(["below_nisab", "hawl_incomplete", "no_balance_sheet_snapshot"]).nullable(),
  detail: z.string().optional(),
  detail_ar: z.string().optional(),
  // Absent when there is no balance-sheet snapshot.
  snapshot_month_end: isoDate.optional(),
  zakatable_assets_sar: z.number().optional(),
  deductible_liabilities_sar: z.number().optional(),
  zakat_base_sar: z.number().optional(),
  nisab_threshold_met: z.boolean().optional(),
  hawl_start_date: isoDate.optional(),
  hawl_completion_date: isoDate.optional(),
  hawl_start_source: z.string().optional(),
});

export const ZakatResponse = z
  .object({ ...lensHeader, zakat: ZakatBody.nullable() })
  .refine((r) => refusalIsExplicit(r.zakat, r), { message: "zakat body and status disagree (§15)" });

export const ProfileResponse = z.object({
  ...header,
  features: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  null_reasons: z.record(z.string(), z.string()),
});

// IN3 (DECISIONS 62): GET /insights/history. A business's own profile figures as of earlier dates, oldest first.
// Like a lens, a null body is legal only as the explicit refusal (§15). It carries the same receipt as /profile.
export const HistoryPoint = z.object({ as_of: isoDate, metrics: z.record(z.string(), z.number()) });
export const HistoryResponse = z
  .object({
    ...header,
    history: z
      .object({ window_days: z.number().int(), step_days: z.number().int(), metrics: z.array(z.string()), points: z.array(HistoryPoint), deterministic: z.literal(true) })
      .nullable(),
  })
  .refine((r) => refusalIsExplicit(r.history, r), { message: "history may be null only with lens_not_run_reason" });

// A scenario object is the Week 8 object, not an API response, so it differs from the routes above:
// sharia_screen sits under governance, the reason key is plural, and credit sections are null, not absent.
export const ScenarioObject = z
  .object({
    ...header,
    lenses_not_run_reason: z.literal("insufficient_data").optional(),
    credit: Credit.nullable(),
    credit_explanation: CreditExplanation.nullable(),
    credit_decision_detail: CreditDetail.nullable(),
    forecast: ForecastBody.nullable(),
    anomaly: AnomalyBody.nullable(),
    zakat: ZakatBody.nullable(),
    governance: z.object({ sharia_screen: ShariaScreen }),
    scenario: z.object({
      id: z.string(),
      label: z.string(),
      library_version: z.string(),
      library_status: z.string(),
      overrides: z.record(z.string(), z.unknown()),
      // POST /scenarios/run (E12): a custom scenario says so and echoes its shocks.
      source: z.literal("custom").optional(),
      shocks: z.array(z.strictObject({ type: z.string(), params: z.record(z.string(), z.number().int()) })).optional(),
    }),
    receipt: Receipt.required({ scope: true }).extend({ scenario_library_sha256: sha256 }),
  })
  .refine((o) => refusalIsExplicit(o.credit, { status: o.status, lens_not_run_reason: o.lenses_not_run_reason }), {
    message: "scenario body and status disagree (§15)",
  });

export const ScenarioIndex = z.object({
  library_version: z.string(),
  library_status: z.string(),
  library_sha256: sha256,
  base_business: z.number().int(),
  code_commit: z.string(),
  scenarios: z.array(
    z.object({ name: z.string(), label: z.string(), story: z.string(), label_ar: z.string().optional(), story_ar: z.string().optional(), output_sha256: sha256 }),
  ),
});

export const HealthResponse = z.object({
  status: z.string(),
  serving_businesses: z.number().int(),
  credit_model_version: z.string(),
});

// GET /businesses (E10, DECISIONS 44): serving businesses only, paged.
export const BusinessesResponse = z.strictObject({
  population: z.literal("serving"),
  data_source: header.data_source,
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(50),
  businesses: z.array(z.strictObject({ business_id: z.number().int(), sector: header.sector })),
});

// GET /scenarios (E12, DECISIONS 44): the library and the bounds of each shock parameter.
const Bound = z.strictObject({ min: z.number(), max: z.number(), step: z.number().positive(), unit: z.string() });
export const ScenarioCatalog = z.strictObject({
  library_version: z.string(),
  library_status: z.string(),
  base_business: z.number().int(),
  scenario_library_sha256: sha256,
  scenarios: z.array(z.strictObject({ name: z.string(), label: z.string(), story: z.string() })),
  max_shocks: z.number().int().min(1),
  shock_types: z.record(z.string(), z.strictObject({ params: z.record(z.string(), Bound), fixed: z.record(z.string(), z.unknown()) })),
});
