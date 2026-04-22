import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score


def train(X_train, y_train, X_test, y_test, rules_N, feature_names):
    model = xgb.XGBClassifier(
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

    top_n = importance_df.head(rules_N)

    # Returns model, its accuracy, and the top rules dataframe
    return {
        "model": model,
        "accuracy": accuracy_score(y_test, preds),
        "top_n_rules": top_n.to_dict(orient="records"),
    }
