from sklearn.model_selection import train_test_split

from dataio.ml.features import build_xy
from dataio.ml.models import xgboost_model, random_forest, decision_tree


def run_ml_pipeline(design_df, train_split, top_n_features, selected_models):
        X, y_labels, y_scores, feature_names = build_xy(design_df)

    X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
                X, y_labels, test_size=(1-train_split), random_state=42
    )

    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
                X, y_scores, test_size=(1-train_split), random_state=42
    )

    results = {}

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

    if "dt_reg" in selected_models:
                results["dt_reg"] = decision_tree.train_regressor(
                                X_train_r, y_train_r, X_test_r, y_test_r, top_n_features, feature_names,
                )

    return results, feature_names
