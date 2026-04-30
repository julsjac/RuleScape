# Orchestrates the ML training pipeline.
# Called by runner.py after Knox data has been fetched and formatted into a DataFrame.
from sklearn.model_selection import train_test_split

from dataio.ml.features import build_xy # Extracts X, y_labels, y_scores from the design DataFrame
from dataio.ml.models import xgboost_model, random_forest, decision_tree


def run_ml_pipeline(design_df, train_split, top_n_features, selected_models):

    # Trains one or more ML models on genetic design-to-rule data.

    # Args:
    #     design_df:       DataFrame from Knox with columns [labels, scores, <rule features...>]
    #     train_split:     Fraction of data to use for training, e.g. 0.8 (already divided by 100 in runner.py)
    #     top_n_features:  How many top-importance features to return per model
    #     selected_models: List of model keys to run — any of: "xgb", "rf", "dt_bin", "dt_reg"

    # Returns:
    #     results:       Dict keyed by model name, each containing metrics and feature importances
    #     feature_names: List of rule names corresponding to feature columns in X
    
    # Extract feature matrix and labels from the design DataFrame
    X, y_labels, y_scores, feature_names = build_xy(design_df)

    # Binary split — used by classifiers (xgb, rf, dt_bin) which predict labels (0 or 1)
    X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
        X, y_labels, test_size=(1 - train_split), random_state=42
    )

    # Regression split — used by dt_reg which predicts continuous scores
    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
        X, y_scores, test_size=(1 - train_split), random_state=42
    )

    results = {}
    
    # Each block below only runs if the user selected that model in the frontend.
    # All classifiers share the same binary train/test split.
    if "xgb" in selected_models:
        results["xgb"] = xgboost_model.train(
            X_train_b, y_train_b, X_test_b, y_test_b, top_n_features, feature_names,
        )

    if "rf" in selected_models:
        results["rf"] = random_forest.train(
            X_train_b, y_train_b, X_test_b, y_test_b, top_n_features, feature_names,
        )

    if "dt_bin" in selected_models:
        results["dt_bin"] = decision_tree.train_classifier(
            X_train_b, y_train_b, X_test_b, y_test_b, top_n_features, feature_names,
        )

    # dt_reg uses the regression split (continuous scores) instead of binary labels
    if "dt_reg" in selected_models:
        results["dt_reg"] = decision_tree.train_regressor(
            X_train_r, y_train_r, X_test_r, y_test_r, top_n_features, feature_names,
        )

    return results, feature_names
