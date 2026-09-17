"""Berka (PKDD'99) adapter — SOP_Data_Grounding_And_Dimensions v2.0 §4–§5.

Reads the raw Berka CSVs from data/berka_raw/ and emits the repo's existing
table contract into data/berka/, validated against the same Pandera schemas the
generator uses. Nothing in the profile engine is Berka-aware.
"""
