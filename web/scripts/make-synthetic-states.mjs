// Writes *_synthetic_state.json: copies of real fixtures edited into states the quick data never
// reaches, shaped from the code that produces them. They are for tests only, and their receipt hashes
// no longer describe their bodies. Everything else in fixtures/ comes from the real API.
//   node scripts/make-synthetic-states.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const read = (name) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));
const write = (name, body) => writeFileSync(join(dir, `${name}_synthetic_state.json`), JSON.stringify(body, null, 2) + "\n");

// lenses/credit/model.py apply_sharia_gate, compliance/sharia_rules.yaml explanations.hard_flag
const rule = { rule_id: "ACT-HARD-5921", severity: "hard_flag", detail: "MCC 5921: package stores — beer, wine, liquor" };
const explanation = `This application cannot be financed: the business's registered activity (${rule.detail}) falls outside Sharia guidelines (rule ${rule.rule_id}).`;
const hard = read("credit_10001");
Object.assign(hard.credit, { decision: "declined", amount_sar: null, base_markup_pct: null, repayment_months: null });
Object.assign(hard.credit_decision_detail, {
  decline_reason: "sharia_hard_flag",
  decline_origin: "compliance",
  risk_tier: null,
  offer_status: null,
  risk_assessment_used_for_decision: false,
  sharia_screen_status: "hard_flag",
});
hard.credit_explanation.public_tier = [{ feature_id: null, text: explanation, magnitude: null, direction: null, source: "compliance" }];
Object.assign(hard.sharia_screen, {
  sharia_screen_status: "hard_flag",
  evidence_basis: "declared_mcc",
  declared_mcc: 5921,
  rules_triggered: [rule],
  owner_prompts: [],
  disclosures: [],
  compliance_explanation: explanation,
});
write("credit_hard_flag", hard);

// lenses/zakat/zakat.py: no snapshot returns the base fields only, with liability_sar still 0.0
const noSnapshot = read("zakat_10001");
const { nisab_value_sar, nisab_basis, nisab_source_status, rate, method, hawl_rule, deterministic } = noSnapshot.zakat;
noSnapshot.zakat = {
  liability_sar: 0,
  nisab_value_sar,
  nisab_basis,
  nisab_source_status,
  rate,
  method,
  hawl_rule,
  deterministic,
  status: "not_computed",
  reason: "no_balance_sheet_snapshot",
};
write("zakat_not_computed", noSnapshot);

const belowNisab = read("zakat_10001");
Object.assign(belowNisab.zakat, { liability_sar: 0, nisab_threshold_met: false, status: "zero_liability", reason: "below_nisab" });
write("zakat_below_nisab", belowNisab);

// lenses/forecast/forecast.py and lenses/anomaly/anomaly.py early returns
const forecast = read("forecast_10001");
forecast.forecast = { status: "not_computed", reason: "insufficient_history", history_days: 12 };
write("forecast_not_computed", forecast);

const anomaly = read("anomaly_10001");
anomaly.anomaly = { status: "not_computed", reason: "too_few_transactions_for_a_baseline", transactions_scanned: 7, flags: [] };
write("anomaly_not_computed", anomaly);
