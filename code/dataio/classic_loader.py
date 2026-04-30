#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# load .csv file 

from pathlib import Path
from typing import Tuple
import numpy as np
import pandas as pd
from scipy.io import loadmat


class ClassicLoader:
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        if not self.root_dir.exists():
            raise FileNotFoundError(f"Directory not found: {self.root_dir}")
            
    def load_average_384_expression(self, filename="Average_384_expression.csv") -> pd.DataFrame:
        """
        Load the 384 expression table
        Parameters
        ----------
        filename : TYPE, optional
            DESCRIPTION. The default is "Average_384_expression.csv".

        Returns
        -------
        dataframe

        """
        path = self.root_dir / filename
        if not path.exists():
            raise FileNotFoundError(path)
            
        df = pd.read_csv(path, sep="\t")
        expected = {"Expression", "Prom", "Kozak", "Term"}
        missing = expected - set(df.columns)
        if missing:
            raise ValueError(f"Missing expected column: {missing} ")
        df = df.copy()
        df["Expression"] = pd.to_numeric(df["Expression"], errors="coerce")
        df = df.dropna(subset=["Expression", "Prom", "Kozak", "Term"]).reset_index(drop=True) 
        return df
    
    def load_single_input_measurements(self, filename="Single_input_measurements.mat") -> Tuple[np.ndarray, np.ndarray]:
        """
        Parameters
        ----------
        filename : TYPE, optional
            DESCRIPTION. The default is "Single_input_measurements.mat".

        Returns
        -------
        assign and expression

        """
        path = self.root_dir /  filename
        if not path.exists():
            raise FileNotFoundError(path)

        data = loadmat(path, squeeze_me=True, struct_as_record=False)

        if "eu_ordered_assign_split" not in data:
            raise KeyError("Missing eu_ordered_assign_split")
        if "ordered_eu_exp" not in data:
            raise KeyError("Missing ordered_eu_exp")

        assign = np.asarray(data["eu_ordered_assign_split"])
        expr = np.asarray(data["ordered_eu_exp"])

        return assign, expr
    
    def load_single_input_for_ucf(self, filename="Single_input_measurements.mat") -> pd.DataFrame:
        """
        Load and prepare the CLASSIC single-input dataset for UCF generation.
        """
        df = self.build_single_input_dataframe(filename).copy()
        
        # rename expression columns
        rename_map = {
            "expr_col_1": "basal_expr",
            "expr_col_2": "induced_expr",
            "expr_col_3": "fold_change",
            "expr_col_4": "quality_metric"
        }
        df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    
        for col in ["basal_expr", "induced_expr", "fold_change", "quality_metric"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
    
        # GIVE REWARD TO DESIGNS WITH BOTH HIGH INDUCTION AND HIGH FOLD CHANGE
        #separate weak and strong swtiches
        
        df["switch_score"] = (
        df["induced_expr"] - df["basal_expr"]
        ) * df["fold_change"]
    
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna(subset=["basal_expr", "induced_expr", "fold_change", "switch_score"]).reset_index(drop=True)
    
        return df

    def build_single_input_dataframe(self, filename="Single_input_measurements.mat") -> pd.DataFrame:
        """
        Build a basic dataframe from the larger .mat file.
        """
        assign, expr = self.load_single_input_measurements(filename)

        if assign.shape[0] != expr.shape[0]:
            raise ValueError("assign and expr row counts do not match")

        design_cols = [f"design_col_{i+1}" for i in range(assign.shape[1])]
        expr_cols = [f"expr_col_{i+1}" for i in range(expr.shape[1])]

        df_assign = pd.DataFrame(assign, columns=design_cols)
        df_expr = pd.DataFrame(expr, columns=expr_cols)

        df = pd.concat([df_assign, df_expr], axis=1)

        if "expr_col_1" in df.columns and "design_col_3" in df.columns:
            df = df[(df["expr_col_1"] > 0) & (df["design_col_3"] > 1)].copy()

        df.reset_index(drop=True, inplace=True)
        return df

    def build_384_ohe(self, filename="Average_384_expression.csv"):
        """
        One-hot encode the small 384 dataset for ML.
        """
        df = self.load_average_384_expression(filename)
        X = pd.get_dummies(df[["Prom", "Kozak", "Term"]].astype(str))
        y = df["Expression"].astype(float)
        return X, y

    def summarize(self):
        print(f"[INFO] Root directory: {self.root_dir}")

        try:
            df = self.load_average_384_expression()
            print(f"[INFO] 384-expression table shape: {df.shape}")
            print(df.head())
        except Exception as e:
            print(f"[WARNING] Could not load Average_384_expression.csv: {e}")

        try:
            assign, expr = self.load_single_input_measurements()
            print(f"[INFO] eu_ordered_assign_split shape: {assign.shape}")
            print(f"[INFO] ordered_eu_exp shape: {expr.shape}")
        except Exception as e:
            print(f"[WARNING] Could not load Single_input_measurements.mat: {e}")


if __name__ == "__main__":
    loader = ClassicLoader(".")
    loader.summarize()
        