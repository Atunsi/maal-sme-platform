"""Saudi national source calibration — SOP_Saudi_Calibration_Sources v1.0.

Phase scripts (run from the repo root, in this order):

    python -m calibration.probe_sources      Phase 0  verify + archive sources; Monsha'at pagination probe
    python -m calibration.monshaat_pull      Phase 1  all pages, three quarters → sources/monshaat/
    python -m calibration.sector_mix         Phase 1  ISIC → four sectors, national weights + tier splits
    python -m calibration.seasonality        Phase 2  §22 NNLS decomposition with Gregorian controls
    python -m calibration.ticket_size        Phase 3  value ÷ count per sector
    python -m calibration.holdout_validate   Phase 3  2024–2025 held out, never refitted
    python -m calibration.credit_intensity   Phase 4  bank credit ÷ SME count, Individuals' Loans excluded
    python -m calibration.apply_config       Phase 5  write the measured values into config.yaml with source comments
    python -m calibration.write_report       Phase 6  /maal/saudi_calibration_report.md

Every script writes its measurements to calibration/out/<phase>.json. Nothing here edits
config.yaml except apply_config, and nothing here reads a validation target — SOP §2.1:
inputs come from sources, never from targets.
"""
