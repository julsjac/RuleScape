#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path

import numpy as np
import pandas as pd

from classic_loader import ClassicLoader


def derive_classic_sensor_params(df: pd.DataFrame) -> dict:
    """
    Derive a two-state input sensor directly from the CLASSIC single-input dataset.

    Because the dataset appears to provide low/high behavior rather than a full
    dose-response curve, we derive a binary sensor abstraction using robust
    summaries of basal and induced expression.
    """
    required = {"basal_expr", "induced_expr"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns for sensor derivation: {missing}")

    clean = (
        df[["basal_expr", "induced_expr"]]
        .replace([np.inf, -np.inf], np.nan)
        .dropna()
        .copy()
    )

    if clean.empty:
        raise ValueError("No valid rows available to derive sensor parameters.")

    ymin = float(clean["basal_expr"].quantile(0.10))
    ymax = float(clean["induced_expr"].quantile(0.90))  

    # Safety guard
    if ymax <= ymin:
        ymax = ymin + 1.0

    return {
        "ymin": ymin,
        "ymax": ymax,
    }


def build_input_json_from_dataset(df: pd.DataFrame) -> list[dict]:
    """
    Build a data-derived, generic Cello input file.
    """
    sensor = derive_classic_sensor_params(df)

    return [
        {
            "collection": "input_sensors",
            "name": "CLASSIC_input_sensor",
            "model": "CLASSIC_input_sensor_model",
            "structure": "CLASSIC_input_sensor_structure"
        },
        {
            "collection": "models",
            "name": "CLASSIC_input_sensor_model",
            "functions": {
                "response_function": "sensor_response"
            },
            "parameters": [
                {
                    "name": "ymax",
                    "value": sensor["ymax"],
                    "description": "Dataset-derived high-state promoter activity"
                },
                {
                    "name": "ymin",
                    "value": sensor["ymin"],
                    "description": "Dataset-derived low-state promoter activity"
                }
            ]
        },
        {
            "collection": "structures",
            "name": "CLASSIC_input_sensor_structure",
            "outputs": [
                "CLASSIC_input_promoter"
            ]
        },
        {
            "collection": "input_devices",
            "name": "CLASSIC_input_device",
            "promoter": "CLASSIC_input_promoter",
            "sensor": "CLASSIC_input_sensor"
        },
        {
            "collection": "functions",
            "name": "sensor_response",
            "equation": "$STATE * (ymax - ymin) + ymin",
            "parameters": [
                {
                    "name": "ymax",
                    "map": "#//model/parameters/ymax"
                },
                {
                    "name": "ymin",
                    "map": "#//model/parameters/ymin"
                }
            ]
        },
        {
            "collection": "parts",
            "type": "promoter",
            "name": "CLASSIC_input_promoter",
            "dnasequence": ""
        }
    ]


def build_output_json() -> list[dict]:
    """
    Build a simple one-input reporter output file.
    This stays generic and does not borrow named regulatory biology.
    """
    yfp_cassette = (
        "CTGAAGCTGTCACCGGATGTGCTTTCCGGTCTGATGAGTCCGTGAGGACGAAACAGCCTCTACAAATAATTTTGTTTAATA"
        "CTAGAGAAAGAGGGGAAATACTAGATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTG"
        "GACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAG"
        "TTCATCTGCACCACAGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCTTCGGCTACGGCCTGCAATGCTTCGCC"
        "CGCTACCCCGACCACATGAAGCTGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTC"
        "TTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAG"
        "GGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATG"
        "GCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGAC"
        "CACTACCAGCAGAACACCCCAATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTTAGCTACCAGTCCGCCCTG"
        "AGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGAC"
        "GAGCTGTACAAGTAACTCGGTACCAAATTCCAGAAAAGAGGCCTCCCGAAAGGGGGGCCTTTTTTCGTTTTGGTCC"
    )

    return [
        {
            "collection": "measurement_std",
            "signal_carrier_units": "AU"
        },
        {
            "collection": "output_devices",
            "name": "CLASSIC_output_reporter",
            "model": "CLASSIC_output_reporter_model",
            "structure": "CLASSIC_output_reporter_structure"
        },
        {
            "collection": "models",
            "name": "CLASSIC_output_reporter_model",
            "functions": {
                "response_function": "linear_response",
                "input_composition": "linear_input_composition"
            },
            "parameters": [
                {
                    "name": "unit_conversion",
                    "value": 1.0
                }
            ]
        },
        {
            "collection": "structures",
            "name": "CLASSIC_output_reporter_structure",
            "inputs": [
                {
                    "name": "in1",
                    "part_type": "promoter"
                }
            ],
            "devices": [
                {
                    "name": "CLASSIC_output_reporter",
                    "components": [
                        "#in1",
                        "YFP_cassette"
                    ]
                }
            ]
        },
        {
            "collection": "parts",
            "type": "cassette",
            "name": "YFP_cassette",
            "dnasequence": yfp_cassette
        },
        {
            "collection": "functions",
            "name": "linear_response",
            "equation": "c * x",
            "variables": [
                {
                    "name": "x",
                    "map": "#//model/functions/input_composition"
                }
            ],
            "parameters": [
                {
                    "name": "c",
                    "map": "#//model/parameters/unit_conversion"
                }
            ]
        },
        {
            "collection": "functions",
            "name": "linear_input_composition",
            "equation": "x"
        },
        {
            "collection": "device_rules",
            "rules": {
                "function": "AND",
                "rules": [
                    "ALL_FORWARD"
                ]
            }
        }
    ]


def build_verilog_text() -> str:
    """
    Minimal 1-input NOT circuit for first Cello test.
    """
    return """module classic_not_test(in1, out1);
    input in1;
    output out1;

    assign out1 = ~in1;
endmodule
"""


def write_json(path: Path, payload: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def main():
    loader = ClassicLoader(".")
    df = loader.load_single_input_for_ucf()

    input_json = build_input_json_from_dataset(df)
    output_json = build_output_json()
    verilog_text = build_verilog_text()

    input_path = Path("CLASSIC_single_input.input.json")
    output_path = Path("CLASSIC_single_input.output.json")
    verilog_path = Path("classic_not_test.v")

    write_json(input_path, input_json)
    write_json(output_path, output_json)

    with verilog_path.open("w", encoding="utf-8") as f:
        f.write(verilog_text)

    sensor = derive_classic_sensor_params(df)

    print(f"[INFO] Wrote: {input_path}")
    print(f"[INFO] Wrote: {output_path}")
    print(f"[INFO] Wrote: {verilog_path}")
    print("[INFO] These input/output files are shared across UCF subset modes.")
    print("[INFO] Dataset-derived sensor parameters:")
    print(f"       ymin = {sensor['ymin']:.6f}")
    print(f"       ymax = {sensor['ymax']:.6f}")

if __name__ == "__main__":
    main()