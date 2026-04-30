#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Fri Apr 10 12:26:02 2026

@author: juliettejacques
"""

import json
import pandas as pd


def make_header(version_name="CLASSIC_single_input"):
    return {
        "collection": "header",
        "description": "Custom empirical single-input UCF derived from CLASSIC single-input measurements",
        "version": version_name,
        "author": ["Juliette Jacques"],
        "organism": "Custom / derived from CLASSIC single-input library"
    }


def make_measurement_std():
    return {
        "collection": "measurement_std",
        "signal_carrier_units": "AU"
    }


def make_logic_constraints():
    return {
        "collection": "logic_constraints",
        "available_gates": [
            {
                "type": "NOT",
                "max_instances": True
            }
        ]
    }


def make_gate_name(row: pd.Series, gate_idx: int) -> str:
    """
    Stable gate naming.
    If a design_id column exists, use it.
    Otherwise fall back to CLASSIC_SI_000001 style naming.
    """
    if "design_id" in row.index and pd.notna(row["design_id"]):
        return str(row["design_id"])
    return f"CLASSIC_SI_{gate_idx:06d}"


def make_structure_entry(gate_name: str):
    """
    One structure per gate so Cello gate names and structure names stay aligned.
    """
    return {
        "collection": "structures",
        "name": f"{gate_name}_structure",
        "inputs": [
            {
                "name": "in1",
                "part_type": "promoter"
            }
        ],
        "outputs": [
            "reporter_output"
        ],
        "devices": [
            {
                "name": f"{gate_name}_synTF_unit",
                "components": [
                    "#in1",
                    "TA_SLOT",
                    "IDP_SLOT",
                    "ZF_SLOT",
                    "SYN_TERMINATOR_SLOT"
                ]
            },
            {
                "name": f"{gate_name}_reporter_unit",
                "components": [
                    "BM_SLOT",
                    "CORE_PROMOTER_SLOT",
                    "REPORTER_GENE",
                    "REPORTER_TERMINATOR"
                ]
            },
            {
                "name": f"{gate_name}_layout_context",
                "components": [
                    "SPACER1_SLOT",
                    "SPACER2_SLOT",
                    "ORIENTATION_SLOT"
                ]
            }
        ]
    }


def make_parts_from_designs(df: pd.DataFrame):
    parts = []
    design_cols = [c for c in df.columns if c.startswith("design_col_")]

    for col in design_cols:
        vals = sorted(pd.Series(df[col]).dropna().unique())
        for v in vals:
            parts.append({
                "collection": "parts",
                "name": f"{col}_{int(v)}",
                "type": "design_factor",
                "dnasequence": ""
            })

    shared_parts = [
        {"collection": "parts", "name": "TA_SLOT", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "IDP_SLOT", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "ZF_SLOT", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "SYN_TERMINATOR_SLOT", "type": "terminator", "dnasequence": ""},
        {"collection": "parts", "name": "BM_SLOT", "type": "promoter", "dnasequence": ""},
        {"collection": "parts", "name": "CORE_PROMOTER_SLOT", "type": "promoter", "dnasequence": ""},
        {"collection": "parts", "name": "CLASSIC_input_promoter", "type": "promoter", "dnasequence": ""},
        {"collection": "parts", "name": "REPORTER_GENE", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "REPORTER_TERMINATOR", "type": "terminator", "dnasequence": ""},
        {"collection": "parts", "name": "SPACER1_SLOT", "type": "scar", "dnasequence": ""},
        {"collection": "parts", "name": "SPACER2_SLOT", "type": "scar", "dnasequence": ""},
        {"collection": "parts", "name": "ORIENTATION_SLOT", "type": "scar", "dnasequence": ""},
    ]
    parts.extend(shared_parts)

    # optional de-duplication by part name
    deduped = []
    seen = set()
    for part in parts:
        key = part["name"]
        if key not in seen:
            deduped.append(part)
            seen.add(key)

    return deduped


def make_model_entry(row: pd.Series, gate_name: str):
    model_name = f"{gate_name}_model"

    ymin = max(float(row["basal_expr"]), 1e-6)
    ymax = max(float(row["induced_expr"]), ymin + 1e-6)
    fc = max(float(row["fold_change"]), 1.0)

    # deterministic heuristic parameters
    if fc < 5:
        K = ymin + 0.25 * (ymax - ymin)
    elif fc < 20:
        K = ymin + 0.40 * (ymax - ymin)
    elif fc < 100:
        K = ymin + 0.55 * (ymax - ymin)
    else:
        K = ymin + 0.70 * (ymax - ymin)

    if fc < 2:
        n = 1.2
    elif fc < 5:
        n = 1.5
    elif fc < 10:
        n = 1.8
    elif fc < 20:
        n = 2.2
    elif fc < 50:
        n = 2.6
    else:
        n = 3.0

    return {
        "collection": "models",
        "name": model_name,
        "functions": {
            "response_function": "Hill_response",
            "input_composition": "linear_input_composition"
        },
        "parameters": [
            {"name": "ymax", "value": ymax, "description": "Maximal transcription"},
            {"name": "ymin", "value": ymin, "description": "Minimal transcription"},
            {"name": "K", "value": K, "description": "Half-maximum"},
            {"name": "n", "value": n, "description": "Empirical cooperativity proxy"}
        ],
        "design_assignment": {
            k: int(row[k]) for k in row.index if k.startswith("design_col_")
        },
        "empirical_values": {
            "basal_expr": float(row["basal_expr"]),
            "induced_expr": float(row["induced_expr"]),
            "fold_change": float(row["fold_change"]),
            "switch_score": float(row["switch_score"])
        }
    }


def make_gate_entry(gate_name: str):
    return {
        "collection": "gates",
        "name": gate_name,
        "system": "CLASSIC_single_input",
        "group": gate_name,
        "regulator": gate_name,
        "gate_type": "NOT",
        "color": "4A90E2",
        "model": f"{gate_name}_model",
        "structure": f"{gate_name}_structure"
    }


def make_functions():
    return [
        {
            "collection": "functions",
            "name": "Hill_response",
            "equation": "ymin + (ymax - ymin) / (1.0 + (x / K)^n)"
        },
        {
            "collection": "functions",
            "name": "linear_input_composition",
            "equation": "x"
        }
    ]


def build_single_input_ucf(
    df: pd.DataFrame,
    top_n: int = 25,
    version_name: str = "CLASSIC_single_input"
    ):
    """
    Export the top-N rows of the dataframe by switch_score.

    This version does NOT do phenotype spacing or diversity filtering.
    It simply:
      1) sorts by switch_score descending
      2) keeps the top_n rows
      3) writes those rows into the UCF
    """
    if df.empty:
        raise ValueError("Input dataframe is empty; cannot build UCF.")

    required_cols = {"basal_expr", "induced_expr", "fold_change", "switch_score"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns for UCF generation: {missing}")

    df = (
        df.copy()
        .sort_values("switch_score", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )

    ucf = []
    ucf.append(make_header(version_name))
    ucf.append(make_measurement_std())
    ucf.append(make_logic_constraints())
    ucf.extend(make_functions())
    ucf.extend(make_parts_from_designs(df))

    for i, row in df.iterrows():
        gate_idx = i + 1
        gate_name = make_gate_name(row, gate_idx)
        ucf.append(make_structure_entry(gate_name))
        ucf.append(make_gate_entry(gate_name))
        ucf.append(make_model_entry(row, gate_name))

    return ucf


def write_ucf_json(ucf, outpath: str):
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(ucf, f, indent=2)