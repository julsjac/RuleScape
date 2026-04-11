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


def make_structure_entry(gate_idx: int):
    return {
        "collection": "structures",
        "name": f"Switch_{gate_idx:03d}_structure",
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
                "name": "synTF_unit",
                "components": [
                    "#in1",
                    "TA_SLOT",
                    "IDP_SLOT",
                    "ZF_SLOT",
                    "SYN_TERMINATOR_SLOT"
                ]
            },
            {
                "name": "reporter_unit",
                "components": [
                    "BM_SLOT",
                    "CORE_PROMOTER_SLOT",
                    "REPORTER_GENE",
                    "REPORTER_TERMINATOR"
                ]
            },
            {
                "name": "layout_context",
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
        vals = sorted(df[col].dropna().unique())
        for v in vals:
            parts.append({
                "collection": "parts",
                "name": f"{col}_{int(v)}",
                "type": "design_factor",
                "dnasequence": ""
            })

    # placeholder shared parts so structure names resolve
    shared_parts = [
        {"collection": "parts", "name": "TA_SLOT", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "IDP_SLOT", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "ZF_SLOT", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "SYN_TERMINATOR_SLOT", "type": "terminator", "dnasequence": ""},

        {"collection": "parts", "name": "BM_SLOT", "type": "promoter", "dnasequence": ""},
        {"collection": "parts", "name": "CORE_PROMOTER_SLOT", "type": "promoter", "dnasequence": ""},

        # data-only generic input promoter
        {"collection": "parts", "name": "CLASSIC_input_promoter", "type": "promoter", "dnasequence": ""},

        {"collection": "parts", "name": "REPORTER_GENE", "type": "cds", "dnasequence": ""},
        {"collection": "parts", "name": "REPORTER_TERMINATOR", "type": "terminator", "dnasequence": ""},
        {"collection": "parts", "name": "SPACER1_SLOT", "type": "scar", "dnasequence": ""},
        {"collection": "parts", "name": "SPACER2_SLOT", "type": "scar", "dnasequence": ""},
        {"collection": "parts", "name": "ORIENTATION_SLOT", "type": "scar", "dnasequence": ""},
    ]
    parts.extend(shared_parts)

    return parts


def make_model_entry(row: pd.Series, gate_idx: int):
    model_name = f"Switch_{gate_idx:03d}_model"

    # approximate Hill-like parameters from measured switch behavior
    ymin = max(float(row["basal_expr"]), 1e-6)
    ymax = max(float(row["induced_expr"]), ymin + 1e-6)
    # map fold change into a more realistic Hill coefficient range
    fc = max(float(row["fold_change"]), 1.0)
    
    # fc (~4-5) -> weak switches
    #fc ~15-20 -> moderate
    #fc ~40-100 -> strong
    
    # scale K based on fold-change regime (for scoring diversity)
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


def make_gate_entry(gate_idx: int):
    gate_name = f"Switch_{gate_idx:03d}"
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


def enforce_spacing(df, min_fc_diff=2.0, min_basal_diff=2000, min_induced_diff=5000):
    selected = []

    for _, row in df.iterrows():
        if not selected:
            selected.append(row)
            continue

        keep = True
        for s in selected:
            fc_close = abs(row["fold_change"] - s["fold_change"]) < min_fc_diff
            basal_close = abs(row["basal_expr"] - s["basal_expr"]) < min_basal_diff
            induced_close = abs(row["induced_expr"] - s["induced_expr"]) < min_induced_diff
            
            # midpoint similarity
            mid_row = 0.5 * (row["basal_expr"] + row["induced_expr"])
            mid_s   = 0.5 * (s["basal_expr"] + s["induced_expr"])
            mid_close = abs(mid_row - mid_s) < 10000

            # reject if too similar in all three phenotype dimensions
            if fc_close and basal_close and induced_close:
                keep = False
                break

        if keep:
            selected.append(row)

    return pd.DataFrame(selected)

def build_single_input_ucf(df: pd.DataFrame, top_n: int = 25, version_name="CLASSIC_single_input"):
    df = df.copy().sort_values("switch_score", ascending=False)

    # 1) remove exact duplicate designs
    design_cols = [c for c in df.columns if c.startswith("design_col_")]
    df = df.drop_duplicates(subset=design_cols)

    # 2) remove duplicate / near-duplicate phenotypes
    df["phenotype_key"] = list(zip(
        df["basal_expr"].round(-2),
        df["induced_expr"].round(-3),
        df["fold_change"].round(1)
    ))
    df = df.drop_duplicates(subset="phenotype_key")

    # 3) assign fold-change bins for diversity
    df["fc_bin"] = pd.cut(
        df["fold_change"],
        bins=[0, 5, 20, 100, 1000, float("inf")],
        labels=["very_low", "low", "medium", "high", "extreme"]
    )

    # 4) take only a small candidate pool from each bin
    selected = []
    for bin_name in ["very_low", "low", "medium", "high", "extreme"]:
        subset = df[df["fc_bin"] == bin_name].sort_values("switch_score", ascending=False)
        if not subset.empty:
            selected.append(subset.head(15))

    if selected:
        candidate_df = pd.concat(selected)
    else:
        candidate_df = df.head(0).copy()

    # 5) fill remaining candidate slots if needed
    if len(candidate_df) < 50:
        remaining = df.loc[~df.index.isin(candidate_df.index)]
        extra = remaining.sort_values("switch_score", ascending=False).head(50 - len(candidate_df))
        candidate_df = pd.concat([candidate_df, extra])

    candidate_df = candidate_df.drop_duplicates(subset="phenotype_key")

    # 6)apply spacing on the much smaller candidate set
    candidate_df = enforce_spacing(candidate_df)

    # 7) final top_n
    df = candidate_df.head(top_n).reset_index(drop=True)
    df = df.drop(columns=["phenotype_key", "fc_bin"], errors="ignore")

    ucf = []
    ucf.append(make_header(version_name))
    ucf.append(make_measurement_std())
    ucf.append(make_logic_constraints())
    ucf.extend(make_functions())
    ucf.extend(make_parts_from_designs(df))
   
    for i, row in df.iterrows():
        gate_idx = i + 1
        ucf.append(make_structure_entry(gate_idx))
        ucf.append(make_gate_entry(gate_idx))
        ucf.append(make_model_entry(row, gate_idx))

    return ucf


def write_ucf_json(ucf, outpath: str):
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(ucf, f, indent=2)