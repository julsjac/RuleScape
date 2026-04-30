#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Fri Apr 10 12:09:40 2026

@author: juliettejacques
"""


from classic_loader import ClassicLoader
from ucf_writer import build_custom_ucf_from_384, write_ucf_json


def main():
    loader = ClassicLoader(".")
    df = loader.load_average_384_expression()

    print(f"[INFO] Loaded dataframe shape: {df.shape}")
    print(df.head())

    ucf = build_custom_ucf_from_384(df)
    outpath = "CLASSIC_384_custom.UCF.json"
    write_ucf_json(ucf, outpath)

    print(f"[INFO] Wrote UCF to: {outpath}")


if __name__ == "__main__":
    main()