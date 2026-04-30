#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Wed Apr  8 15:44:34 2026

@author: juliettejacques
"""

import json
import pandas as pd


def make_header():
    return {
        "collection": "header",
        "description": "Custom empirical UCF derived from CLASSIC 384-expression data",
        "version": "CLASSIC_384_custom_v1",
        "author": ["Juliette Jacques"],
        "organism": "Custom / derived from CLASSIC dataset"
    }


def make_logic_constraints():
    return {
        "collection": "logic_constraints",
        "available_gates": [
            {
                "type": "EMPIRICAL_SWITCH",
                "max_instances": True
            }
        ]
    }


def make_part_entries(df: pd.DataFrame):
    entries = []

    for prom in sorted(df["Prom"].astype(str).unique(), key=float):
        entries.append({
            "collection": "parts",
            "name": f"Prom_{prom}",
            "part_type": "promoter",
            "source_column": "Prom"
        })

    for kozak in sorted(df["Kozak"].astype(str).unique(), key=float):
        entries.append({
            "collection": "parts",
            "name": f"Kozak_{kozak}",
            "part_type": "kozak",
            "source_column": "Kozak"
        })

    for term in sorted(df["Term"].astype(str).unique(), key=float):
        entries.append({
            "collection": "parts",
            "name": f"Term_{term}",
            "part_type": "terminator",
            "source_column": "Term"
        })

    return entries


def make_structure_entry():
    return {
        "collection": "structures",
        "name": "simple_expression_unit_structure",
        "inputs": [],
        "outputs": ["expression_output"],
        "devices": [
            {
                "name": "expression_unit",
                "components": [
                    "PROMOTER_SLOT",
                    "KOZAK_SLOT",
                    "REPORTER_GENE",
                    "TERMINATOR_SLOT"
                ]
            }
        ]
    }


def summarize_expression_by_part(df: pd.DataFrame, colname: str):
    return (
        df.groupby(colname)["Expression"]
        .mean()
        .sort_index()
        .to_dict()
    )


def make_model_entries(df: pd.DataFrame):
    prom_means = summarize_expression_by_part(df, "Prom")
    kozak_means = summarize_expression_by_part(df, "Kozak")
    term_means = summarize_expression_by_part(df, "Term")
    global_mean = float(df["Expression"].mean())

    return [
        {
            "collection": "models",
            "name": "promoter_effect_model",
            "model_type": "empirical_mean_expression",
            "parameters": [
                {"name": f"Prom_{k}", "value": float(v)} for k, v in prom_means.items()
            ]
        },
        {
            "collection": "models",
            "name": "kozak_effect_model",
            "model_type": "empirical_mean_expression",
            "parameters": [
                {"name": f"Kozak_{k}", "value": float(v)} for k, v in kozak_means.items()
            ]
        },
        {
            "collection": "models",
            "name": "terminator_effect_model",
            "model_type": "empirical_mean_expression",
            "parameters": [
                {"name": f"Term_{k}", "value": float(v)} for k, v in term_means.items()
            ]
        },
        {
            "collection": "models",
            "name": "global_expression_model",
            "model_type": "empirical_mean_expression",
            "parameters": [
                {"name": "global_mean_expression", "value": global_mean}
            ]
        }
    ]


def make_gate_entry():
    return {
        "collection": "gates",
        "name": "CLASSIC_384_expression_gate",
        "system": "custom",
        "group": "CLASSIC_384",
        "regulator": "empirical_expression",
        "gate_type": "EMPIRICAL_SWITCH",
        "color": "4A90E2",
        "model": "global_expression_model",
        "structure": "simple_expression_unit_structure"
    }


def build_custom_ucf_from_384(df: pd.DataFrame):
    ucf = []
    ucf.append(make_header())
    ucf.append(make_logic_constraints())
    ucf.extend(make_part_entries(df))
    ucf.append(make_structure_entry())
    ucf.extend(make_model_entries(df))
    ucf.append(make_gate_entry())
    return ucf


def write_ucf_json(ucf, outpath: str):
    with open(outpath, "w", encoding="utf-8") as f:
        json.dump(ucf, f, indent=2)