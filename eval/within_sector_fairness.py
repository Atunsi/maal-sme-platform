
"""Section 25 — Within-sector Credit Lens attribution audit.

Run:
    python -m eval.within_sector_fairness

Outputs:
    eval/out/within_sector_fairness.csv
    eval/out/within_sector_fairness.md

Uses the frozen Credit Lens model and research profiles.
Does not retrain the model or change credit decisions.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from lenses.credit.model import load_artifact, score

DATA = Path("data")
OUT = Path("eval/out")

# Features explicitly highlighted in the Section 25 specification.
SECTION25_IDS = {
    "11", "12", "13", "14", "15",
    "16", "17", "18", "18b", "19",
}

# Additional working-capital features referenced in Entry 1b.
WORKING_CAPITAL_IDS = {"37", "38", "39", "40"}

# Sector-relative features require proxy-risk review.
SECTOR_RELATIVE_IDS = {"55", "56", "57", "58", "59"}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    art = load_artifact("lenses/credit/model_v1.json")

    profiles = pd.read_csv(DATA / "profiles.csv")

    businesses = pd.read_csv(
        DATA / "businesses.csv",
        usecols=["business_id", "sector", "population"],
    )

    statuses = pd.read_csv(
        DATA / "profile_status.csv",
        usecols=["business_id", "status"],
    )

    labels = pd.read_csv(
        DATA / "labels.csv",
        usecols=["business_id", "default_label"],
    )

    df = (
        profiles
        .merge(businesses, on="business_id", validate="one_to_one")
        .merge(statuses, on="business_id", validate="one_to_one")
        .merge(labels, on="business_id", validate="one_to_one")
    )

    serving_df = df[
        (df["population"] == "serving")
        & df["status"].isin(["scored", "partial_profile"])
    ].copy()

    df = df[
        (df["population"] == "research")
        & df["status"].isin(["scored", "partial_profile"])
    ].copy()

    records = []
    predictions = []

    for _, business in df.iterrows():
        predicted_pd, _, contributions = score(business, art)

        predictions.append({
            "business_id": business["business_id"],
            "sector": business["sector"],
            "predicted_pd": predicted_pd,
            "default_label": business["default_label"],
        })

        for contribution in contributions:
            records.append({
                "sector": business["sector"],
                "business_id": business["business_id"],
                "feature_id": str(contribution["feature_id"]),
                "feature": contribution["feature"],
                "contribution": contribution["contribution_logodds"],
            })

    serving_predictions = []

    for _, business in serving_df.iterrows():
        predicted_pd, _, _ = score(business, art)

        serving_predictions.append({
            "business_id": business["business_id"],
            "sector": business["sector"],
            "predicted_pd": predicted_pd,
            "default_label": business["default_label"],
        })

    serving_prediction_df = pd.DataFrame(serving_predictions)

    serving_calibration = (
        serving_prediction_df.groupby("sector")
        .agg(
            n_businesses=("business_id", "count"),
            defaults=("default_label", "sum"),
            predicted_default_rate=("predicted_pd", "mean"),
            observed_default_rate=("default_label", "mean"),
        )
        .reset_index()
    )

    serving_calibration["difference_pp"] = (
        serving_calibration["predicted_default_rate"]
        - serving_calibration["observed_default_rate"]
    ) * 100
    detail = pd.DataFrame(records)
    prediction_df = pd.DataFrame(predictions)

    # Sector-level calibration on the research population.
    calibration = (
        prediction_df.groupby("sector")
        .agg(
            n_businesses=("business_id", "count"),
            defaults=("default_label", "sum"),
            predicted_default_rate=("predicted_pd", "mean"),
            observed_default_rate=("default_label", "mean"),
        )
        .reset_index()
    )

    calibration["difference_pp"] = (
        calibration["predicted_default_rate"]
        - calibration["observed_default_rate"]
    ) * 100

    # Exact additive linear-model attributions:
    # coefficient multiplied by standardized feature value.
    summary = (
        detail.groupby(
            ["sector", "feature_id", "feature"],
            as_index=False,
        )
        .agg(
            n_businesses=("business_id", "nunique"),
            mean_contribution=("contribution", "mean"),
            mean_abs_contribution=(
                "contribution",
                lambda x: float(np.abs(x).mean()),
            ),
            std_contribution=("contribution", "std"),
        )
    )

    summary["std_contribution"] = (
        summary["std_contribution"].fillna(0.0)
    )

    summary["rank_by_impact"] = (
        summary.groupby("sector")["mean_abs_contribution"]
        .rank(method="min", ascending=False)
        .astype(int)
    )

    summary["rank_by_variation"] = (
        summary.groupby("sector")["std_contribution"]
        .rank(method="min", ascending=False)
        .astype(int)
    )

    summary["feature_group"] = np.select(
        [
            summary["feature_id"].isin(SECTION25_IDS),
            summary["feature_id"].isin(WORKING_CAPITAL_IDS),
            summary["feature_id"].isin(SECTOR_RELATIVE_IDS),
        ],
        [
            "section25_liquidity",
            "working_capital",
            "sector_relative",
        ],
        default="other",
    )

    summary = summary.sort_values(
        ["sector", "rank_by_impact", "feature_id"]
    )

    summary.to_csv(
        OUT / "within_sector_fairness.csv",
        index=False,
    )

    calibration.to_csv(
        OUT / "within_sector_calibration.csv",
        index=False,
    )

    serving_calibration.to_csv(
        OUT / "within_sector_serving_calibration.csv",
        index=False,
    )    

    lines = [
        "# Section 25 — Within-Sector Credit Lens Fairness Audit",
        "",
        "## Methodology",
        "",
        f"- Eligible research businesses: **{len(df):,}**",
        f"- Sectors: **{df['sector'].nunique()}**",
        f"- Trained model features: **{len(art['features'])}**",
        "- Population: research, scored or partial_profile.",
        "- Attribution: coefficient × standardized feature value.",
        "- Mean absolute contribution measures feature impact.",
        "- Contribution standard deviation measures variation within a sector.",
        "- No retraining or modification of model predictions.",
        "",
        "These are exact additive contributions for the frozen linear model,",
        "rather than separately estimated SHAP values.",
        "They sum with the intercept to reproduce the model logit.",
        "",
        "## Sector-Level Calibration — Research Population",
        "",
        "| Sector | Businesses | Defaults | Predicted default | Observed default | Difference (pp) |",
        "|---|---:|---:|---:|---:|---:|",
    ]

    for _, r in calibration.iterrows():
        lines.append(
            f"| {r['sector']} "
            f"| {int(r['n_businesses']):,} "
            f"| {int(r['defaults'])} "
            f"| {r['predicted_default_rate']:.2%} "
            f"| {r['observed_default_rate']:.2%} "
            f"| {r['difference_pp']:+.2f} |"
        )

    lines.extend([
        "",
        "Research-population calibration is descriptive and is not",
        "an independent holdout validation.",
        "",
    ])

    lines.extend([
        "## Sector-Level Calibration — Serving Population",
        "",
        "| Sector | Businesses | Defaults | Predicted default | Observed default | Difference (pp) |",
        "|---|---:|---:|---:|---:|---:|",
    ])

    for _, r in serving_calibration.iterrows():
        lines.append(
            f"| {r['sector']} "
            f"| {int(r['n_businesses']):,} "
            f"| {int(r['defaults'])} "
            f"| {r['predicted_default_rate']:.2%} "
            f"| {r['observed_default_rate']:.2%} "
            f"| {r['difference_pp']:+.2f} |"
        )

    lines.extend([
        "",
        "The serving population is separate from the research population.",
        "Sector-level default counts are limited, so observed rates",
        "are uncertain, particularly for professional services.",
        "Calibration differences alone do not establish fairness.",
        "",
    ])

    # Attribution ranking for every sector.
    for sector, group in summary.groupby("sector", sort=True):
        top = group.nsmallest(10, "rank_by_impact")

        lines.extend([
            f"## {sector} — Top 10 Features",
            "",
            f"Eligible businesses: **{int(group['n_businesses'].max()):,}**",
            "",
            "| Rank | Feature ID | Feature | Mean absolute contribution | Within-sector SD |",
            "|---|---|---|---:|---:|",
        ])

        for _, r in top.iterrows():
            lines.append(
                f"| {r['rank_by_impact']} "
                f"| {r['feature_id']} "
                f"| `{r['feature']}` "
                f"| {r['mean_abs_contribution']:.5f} "
                f"| {r['std_contribution']:.5f} |"
            )

        lines.append("")

    # Detailed construction comparison required by Section 25.
    construction = summary[
        summary["sector"] == "construction"
    ].copy()

    if not construction.empty:
        lines.extend([
            "## Construction — Required Feature Comparison",
            "",
            "| Feature ID | Feature | Impact rank | Variation rank | Mean absolute contribution |",
            "|---|---|---:|---:|---:|",
        ])

        focus = construction[
            construction["feature_id"].isin(
                SECTION25_IDS
                | WORKING_CAPITAL_IDS
                | SECTOR_RELATIVE_IDS
            )
        ].sort_values("rank_by_impact")

        for _, r in focus.iterrows():
            lines.append(
                f"| {r['feature_id']} "
                f"| `{r['feature']}` "
                f"| {r['rank_by_impact']} "
                f"| {r['rank_by_variation']} "
                f"| {r['mean_abs_contribution']:.5f} |"
            )

        top_ten = construction.nsmallest(10, "rank_by_impact")
        expected_ids = SECTION25_IDS | WORKING_CAPITAL_IDS

        expected_count = int(
            top_ten["feature_id"].isin(expected_ids).sum()
        )

        sector_relative_count = int(
            top_ten["feature_id"].isin(
                SECTOR_RELATIVE_IDS
            ).sum()
        )

        lines.extend([
            "",
            "## Section 25 — Audit Assessment",
            "",
            (
                f"- Liquidity/working-capital features among construction's "
                f"top 10: **{expected_count}/10**."
            ),
            (
                f"- Sector-relative features among construction's "
                f"top 10: **{sector_relative_count}/10**."
            ),
            "",
            "**Assessment: Not demonstrated / further review required.**",
            "",
            "The Section 25 specification expects construction's",
            "attributions to be dominated by liquidity-trend and",
            "working-capital-resilience signals rather than sector proxies.",
            "The feature rankings must be reviewed against that requirement.",
            "",
            "The absence of an explicit sector-code coefficient does not",
            "rule out indirect sector effects through financial features",
            "or sector-relative reference statistics.",
            "",
            "Sector-average calibration is supplementary evidence only.",
            "It cannot establish that individual businesses are treated",
            "fairly or that the Section 25 criterion has been satisfied.",
            "",
        ])

    lines.extend([
        "## Limitations",
        "",
        "- Data are synthetic and may not represent real lending populations.",
        "- Research-population calibration is not independent validation.",
        "- Small sector/default counts make some estimates uncertain.",
        "- Correlated features can distribute attribution across signals.",
        "- Contribution magnitude alone does not establish causation.",
        "- Sector-relative features require additional proxy-risk review.",
        "- This audit does not establish legal or Sharia compliance.",
        "- No model parameters or credit decisions were changed.",
        "",
        "## Output Files",
        "",
        "- `within_sector_fairness.csv`: attribution results by sector.",
        "- `within_sector_calibration.csv`: research calibration results.",
        "",
    ])

    report = OUT / "within_sector_fairness.md"
    report.write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )

    print(f"Eligible research businesses: {len(df):,}")
    print(f"Sectors: {df['sector'].nunique()}")
    print(f"Features: {len(art['features'])}")
    print(f"CSV: {OUT / 'within_sector_fairness.csv'}")
    print(f"Calibration: {OUT / 'within_sector_calibration.csv'}")
    print(f"Report: {report}")


if __name__ == "__main__":
    main()
