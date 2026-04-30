#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
from classic_loader import ClassicLoader
from single_input_ucf_writer import build_single_input_ucf, write_ucf_json


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top_n", type=int, default=25)
    parser.add_argument("--version_name", type=str, default=None)
    args = parser.parse_args()

    loader = ClassicLoader(".")
    df = loader.load_single_input_for_ucf()

    print("[INFO] Loaded single-input dataframe")
    print(df.head())
    print(f"[INFO] Shape: {df.shape}")

    cols_to_show = [c for c in df.columns if c.startswith("design_col_")] + [
        "basal_expr", "induced_expr", "fold_change", "switch_score"
    ]
    print("\n[INFO] Top 10 switch-like designs:")
    print(df.sort_values("switch_score", ascending=False)[cols_to_show].head(10))

    top_n = args.top_n
    version_name = args.version_name or f"CLASSIC_single_input_top_{top_n}"
    outpath = f"{version_name}.UCF.json"

    ucf = build_single_input_ucf(df, top_n=top_n, version_name=version_name)
    write_ucf_json(ucf, outpath)

    print(f"\n[INFO] Wrote UCF to: {outpath}")


if __name__ == "__main__":
    main()