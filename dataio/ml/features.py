import numpy as np

def build_xy(design_df):
    feature_names = design_df.columns.tolist()[2:]

    X = design_df.iloc[:, 2:].to_numpy(dtype=int)
    y_labels = design_df["labels"].to_numpy(dtype=int)
    y_scores = design_df["scores"].to_numpy(dtype=float)

    return X, y_labels, y_scores, feature_names
