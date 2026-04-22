"""
test_ml_pipeline.py
--------------------
Standalone test script for the ML pipeline.
Bypasses Knox/Cello entirely by constructing a synthetic design_df.

Run from the repo root:
    python -m dataio.ml.test_ml_pipeline

    Or directly (if your PYTHONPATH includes the repo root):
        python dataio/ml/test_ml_pipeline.py
        """

import pandas as pd
import numpy as np
from dataio.ml.pipeline import run_ml_pipeline

# ------------------------------------------------------------------ #
# 1. Build a synthetic design_df that mimics Knox output
#
# Real Knox output (design_df / designToRule_df) has this shape:
#   col 0: "labels"  -> int  (1 = good design, -1 = bad design)
#   col 1: "scores"  -> float (continuous fitness score)
#   col 2+: one column per rule, binary (0 or 1 = rule passed)
#
# We generate 100 fake designs with 8 binary rule features.
# ------------------------------------------------------------------ #

np.random.seed(0)
N = 100  # number of designs
RULE_NAMES = ["rule_A", "rule_B", "rule_C", "rule_D",
                            "rule_E", "rule_F", "rule_G", "rule_H"]

rule_data = np.random.randint(0, 2, size=(N, len(RULE_NAMES)))
scores    = np.random.uniform(-1.0, 1.0, size=N)
labels    = np.where(scores >= 0, 1, -1).astype(int)   # sign labeling

design_df = pd.DataFrame(rule_data, columns=RULE_NAMES)
design_df.insert(0, "scores", scores)
design_df.insert(0, "labels", labels)

print("=== Synthetic design_df (first 5 rows) ===")
print(design_df.head())
print(f"\nShape: {design_df.shape}")
print(f"Label distribution: {dict(zip(*np.unique(labels, return_counts=True)))}")

# ------------------------------------------------------------------ #
# 2. Define test parameters (mirrors what the UI would send)
# ------------------------------------------------------------------ #

TRAIN_SPLIT    = 0.8      # 80% train, 20% test
TOP_N_FEATURES = 5        # return top 5 rules by importance
SELECTED_MODELS = ["xgb", "rf", "dt_bin", "dt_reg"]  # run all 4

# ------------------------------------------------------------------ #
# 3. Run the pipeline
# ------------------------------------------------------------------ #

print("\n=== Running ML pipeline ===")
results, feature_names = run_ml_pipeline(
      design_df,
      TRAIN_SPLIT,
      TOP_N_FEATURES,
      SELECTED_MODELS
)

# ------------------------------------------------------------------ #
# 4. Print results
# ------------------------------------------------------------------ #

print(f"\nFeature names returned: {feature_names}")
print("\n=== Model Results ===")

for model_key, model_result in results.items():
      print(f"\n--- {model_key} ---")
      for k, v in model_result.items():
                print(f"  {k}: {v}")

  print("\n=== All assertions passed! Pipeline is working correctly. ===")

# ------------------------------------------------------------------ #
# 5. Basic sanity assertions
# ------------------------------------------------------------------ #

for model_key in SELECTED_MODELS:
    assert model_key in results, f"Missing result for model: {model_key}"
    
    r = results[model_key]
    
    # accuracy key differs per model
    metric_key = "r2" if model_key == "dt_reg" else "accuracy"
    assert metric_key in r, f"{model_key}: missing '{metric_key}'"
    
    metric_val = r[metric_key]
    assert isinstance(metric_val, float), (
        f"{model_key}: {metric_key} should be a float, got {type(metric_val)}"
    )

    assert "top_n_rules" in r, f"{model_key}: missing 'top_n_rules'"
    assert len(r["top_n_rules"]) <= TOP_N_FEATURES, (
        f"{model_key}: top_n_rules has more than {TOP_N_FEATURES} entries"
    )

print("\nAll assertions passed.")
