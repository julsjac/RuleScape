import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score


def train(X_train, y_train, X_test, y_test, rules_N, feature_names):
    model = xgb.XGBClassifier(
        max_depth=10,
        learning_rate=0.1,
        objective="binary:logistic",
        random_state=42,
        eval_metric="auc"
    )

    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    # Retrieves top features from the XGB Model
    booster = model.get_booster()
    booster.feature_names = list(feature_names)
    importance = booster.get_score(importance_type="weight")

    importance_df = pd.DataFrame({
        "feature": list(importance.keys()),
        "importance": list(importance.values())
    })

    importance_df = importance_df.sort_values(
        by="importance",
        ascending=False
    )

    top_features = importance_df.head(rules_N).reset_index(drop=True)

    # Returns model, its accuracy, and the top rules dataframe
    return {
        "accuracy": float(accuracy_score(y_test, preds)),
        "top_n_rules": top_features.to_dict(orient="records"),
        "model_summary": {
            "type": "XGBoost",
            "feature_count": len(feature_names)
        }
    }
