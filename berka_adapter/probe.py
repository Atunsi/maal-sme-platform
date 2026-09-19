"""Phase 0 viability probes — SOP_Data_Grounding §4. HARD GATE.

Reads and prints. Writes nothing. Results are copied into DECISIONS.md by hand
regardless of outcome, because the probe outcomes decide coverage-band
membership (§6.1), entity resolution (§5.3), and whether Phase 5c is mandatory.

    python -m berka_adapter.probe [--raw-dir data/berka_raw]

Probe 1  do balances go negative?            -> features 13, 14, 15
Probe 2  is trans.account a usable partner?  -> features 5, 20, 21, 22, 45, 46
Probe 3  structural sanity                   -> dates, row counts, loan.status, loan.duration
Probe 4  do clients hold multiple accounts?  -> business_id mapping, own-transfer netting
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from berka_adapter.io import load_all, load_column_map

PARTNER_MIN_TX_SHARE = 0.20  # Probe 2 pass threshold (SOP §4)
NEGATIVE_MIN_ACCOUNT_SHARE = 0.05  # Probe 1 pass threshold
MULTI_ACCOUNT_MAX_CLIENT_SHARE = 0.02  # Probe 4 single-account-safe threshold


def hr(title: str) -> None:
    print(f"\n== {title} ==")


def probe_1_negative_balances(trans: pd.DataFrame) -> dict:
    hr("Probe 1 — do balances go negative? (features 13, 14, 15)")
    t = trans.sort_values(["account_id", "date", "trans_id"])
    min_bal = t.groupby("account_id")["balance"].min()
    ever_neg = min_bal < 0
    share = float(ever_neg.mean())
    print(f"  accounts ever below zero: {int(ever_neg.sum())} / {len(min_bal)} = {share:.1%}")

    # Days below zero: last balance per (account, day) holds until the next transaction day.
    daily = t.groupby(["account_id", "date"], as_index=False)["balance"].last()
    daily["next_date"] = daily.groupby("account_id")["date"].shift(-1)
    end = trans["date"].max() + pd.Timedelta(days=1)
    daily["next_date"] = daily["next_date"].fillna(end)
    daily["days_held"] = (daily["next_date"] - daily["date"]).dt.days
    neg_days = daily[daily["balance"] < 0].groupby("account_id")["days_held"].sum()
    neg_days = neg_days.reindex(min_bal.index[ever_neg]).fillna(0)
    print(f"  of those, days below zero: median {neg_days.median():.0f}, mean {neg_days.mean():.0f}, max {neg_days.max():.0f}")

    sanc = trans[trans["k_symbol"] == "SANKC. UROK"]
    print(f"  SANKC. UROK (sanction interest) transactions: {len(sanc):,} across {sanc['account_id'].nunique()} accounts")
    verdict = share >= NEGATIVE_MIN_ACCOUNT_SHARE
    print(f"  {'PASS' if verdict else 'FAIL'}: share ever negative {'>=' if verdict else '<'} {NEGATIVE_MIN_ACCOUNT_SHARE:.0%}"
          f" -> features 13-15 are class {'A' if verdict else 'C'}")
    return {"pass": verdict, "share_ever_negative": share, "median_days_negative": float(neg_days.median()),
            "sanction_tx": len(sanc), "sanction_accounts": int(sanc["account_id"].nunique())}


def probe_2_counterparty_key(trans: pd.DataFrame) -> dict:
    hr("Probe 2 — is bank+account a usable counterparty key? (features 5, 20-22, 45, 46)")
    has_partner = trans["bank"].notna() & trans["account"].notna() & (trans["bank"].str.strip() != "")
    print("  partner null rate by operation:")
    by_op = trans.assign(has=has_partner).groupby("operation")["has"].agg(["mean", "size"])
    for op, row in by_op.iterrows():
        print(f"    {op or '<blank>':16s} non-null {row['mean']:.1%}   n={int(row['size']):,}")
    share_tx = float(has_partner.mean())
    print(f"  transactions with a non-null partner: {share_tx:.1%}")

    p = trans[has_partner]
    key = p["bank"].str.strip() + ":" + p["account"].str.strip()
    ratio = key.nunique() / max(len(p), 1)
    print(f"  distinct partner keys / partnered transactions: {key.nunique():,} / {len(p):,} = {ratio:.3f}"
          "  (near 1.0 = unique per transaction = useless as identity)")

    rng = np.random.default_rng(0)
    sample = rng.choice(p["account_id"].unique(), size=min(20, p["account_id"].nunique()), replace=False)
    rows = []
    for a in sample:
        g = p[(p["account_id"] == a)].copy()
        g["key"] = g["bank"].str.strip() + ":" + g["account"].str.strip()
        inflow = g[g["type"] == "PRIJEM"]
        counts = inflow["key"].value_counts()
        repeat_keys = counts[counts >= 2].index
        repeat_share = inflow.loc[inflow["key"].isin(repeat_keys), "amount"].sum() / max(inflow["amount"].sum(), 1e-9)
        rows.append((a, g["key"].nunique(), len(g), float(repeat_share)))
    s = pd.DataFrame(rows, columns=["account_id", "distinct_partners", "partnered_tx", "repeat_partner_inflow_share"])
    print("  20 sampled accounts (partner count, partnered tx, repeat-partner share of inflow value):")
    print(s.to_string(index=False, formatters={"repeat_partner_inflow_share": "{:.2f}".format}))
    med_repeat = float(s["repeat_partner_inflow_share"].median())
    verdict = share_tx > PARTNER_MIN_TX_SHARE and med_repeat > 0.05
    print(f"  {'PASS' if verdict else 'FAIL'}: partner on {share_tx:.1%} of tx (need >{PARTNER_MIN_TX_SHARE:.0%}), "
          f"median repeat-partner inflow share {med_repeat:.2f} (need meaningfully > 0)"
          f" -> counterparty band is class {'A' if verdict else 'C'}")
    return {"pass": verdict, "share_tx_with_partner": share_tx, "distinct_key_ratio": float(ratio),
            "median_repeat_partner_inflow_share": med_repeat}


def probe_3_structural(tables: dict[str, pd.DataFrame], cmap: dict) -> dict:
    hr("Probe 3 — structural sanity")
    ok = True
    for name, pub in cmap["published_rows"].items():
        n = len(tables[name])
        flag = "ok" if n == pub else "MISMATCH"
        ok &= n == pub
        print(f"  {name:9s} rows {n:>10,}   published {pub:>10,}   {flag}")
    for name, cols in (("trans", ["date"]), ("account", ["date"]), ("loan", ["date"]), ("card", ["issued"])):
        for c in cols:
            d = tables[name][c]
            lo, hi = d.min(), d.max()
            inside = (d.dt.year >= 1993).all() and (d.dt.year <= 1999).all()
            ok &= inside
            print(f"  {name}.{c}: {lo.date()} → {hi.date()}  {'ok' if inside else 'OUTSIDE 1993-1999'}")
    loan = tables["loan"]
    print("  loan.status counts (A finished-ok, B finished-default, C running-ok, D running-in-debt):")
    vc = loan["status"].value_counts().reindex(["A", "B", "C", "D"]).fillna(0).astype(int)
    for k, v in vc.items():
        print(f"    {k}: {v}")
    print(f"    primary label set (A vs B): n={vc['A'] + vc['B']}, defaults={vc['B']}")
    print(f"    secondary label set (A+C vs B+D): n={len(loan)}, defaults={vc['B'] + vc['D']}")
    print("  loan.duration distribution (months):")
    dur = loan["duration"].value_counts().sort_index()
    for k, v in dur.items():
        print(f"    {k:>3d}: {v}")
    print(f"  {'PASS' if ok else 'FAIL'}: structural checks")
    return {"pass": bool(ok), "status_counts": vc.to_dict(), "duration_counts": {int(k): int(v) for k, v in dur.items()}}


def probe_4_multi_account(tables: dict[str, pd.DataFrame]) -> dict:
    hr("Probe 4 — do clients hold multiple accounts? (business_id mapping)")
    disp, trans = tables["disp"], tables["trans"]
    per_client = disp.groupby("client_id")["account_id"].nunique()
    dist = per_client.value_counts().sort_index()
    print("  accounts per client (via disp, any role):")
    for k, v in dist.items():
        print(f"    {k}: {v}")
    multi_share = float((per_client > 1).mean())
    print(f"  clients holding >1 account: {int((per_client > 1).sum())} / {len(per_client)} = {multi_share:.2%}")
    owners = disp[disp["type"] == "OWNER"]
    print(f"  OWNER rows: {len(owners)} for {owners['account_id'].nunique()} accounts "
          f"({owners['client_id'].nunique()} distinct owner clients)")
    print(f"  DISPONENT rows: {int((disp['type'] == 'DISPONENT').sum())} — a second person on the same account, not a second account")

    # Candidate own-account transfers: same client, matching amount, ±2 days, opposite sign, both accounts in the client's set.
    multi = per_client[per_client > 1].index
    cand_value, cand_pairs = 0.0, 0
    if len(multi):
        acc_sets = disp[disp["client_id"].isin(multi)].groupby("client_id")["account_id"].apply(set)
        tf = trans[trans["operation"].isin(["PREVOD Z UCTU", "PREVOD NA UCET"])]
        for accs in acc_sets.values:
            g = tf[tf["account_id"].isin(accs)]
            out = g[g["type"] == "VYDAJ"]
            inn = g[g["type"] == "PRIJEM"]
            m = out.merge(inn, on="amount", suffixes=("_o", "_i"))
            m = m[(m["account_id_o"] != m["account_id_i"]) & ((m["date_i"] - m["date_o"]).dt.days.abs() <= 2)]
            cand_pairs += len(m)
            cand_value += float(m["amount"].sum())
    total_inflow = float(trans.loc[trans["type"] == "PRIJEM", "amount"].sum())
    print(f"  candidate own-account transfer pairs: {cand_pairs}, value {cand_value:,.0f} = {cand_value / total_inflow:.3%} of total inflow")
    verdict = multi_share < MULTI_ACCOUNT_MAX_CLIENT_SHARE and cand_value / total_inflow < 0.005
    print(f"  {'PASS (single-account safe)' if verdict else 'FAIL (multi-account)'}: "
          f"{'business_id = account_id; record the assumption' if verdict else 'business_id = client_id via disp; net own transfers; Phase 5c mandatory'}")
    return {"pass": verdict, "multi_account_client_share": multi_share, "own_transfer_pairs": cand_pairs,
            "own_transfer_value_share": cand_value / total_inflow}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw-dir", default="data/berka_raw")
    args = ap.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows consoles default to a legacy code page
    cmap = load_column_map()
    print(f"loading raw Berka tables from {Path(args.raw_dir).resolve()} (column map verified per table) …")
    tables = load_all(Path(args.raw_dir))
    for n, df in tables.items():
        print(f"  {n:9s} {len(df):>10,} rows  columns verified: {list(df.columns)}")

    results = {
        "probe_1": probe_1_negative_balances(tables["trans"]),
        "probe_2": probe_2_counterparty_key(tables["trans"]),
        "probe_3": probe_3_structural(tables, cmap),
        "probe_4": probe_4_multi_account(tables),
    }
    hr("Summary (copy into DECISIONS.md)")
    for k, v in results.items():
        print(f"  {k}: {'PASS' if v['pass'] else 'FAIL'}  {({kk: vv for kk, vv in v.items() if kk != 'pass'})}")
    print("\nprobe writes nothing. Gate decision is recorded by hand in DECISIONS.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
