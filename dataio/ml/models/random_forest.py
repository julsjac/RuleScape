import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score


def train(X_train, y_train, X_test, y_test, rules_N, feature_names, max_depth=3):
    model = RandomForestClassifier(max_depth=max_depth, random_state=0)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    # Extract importances and pair with feature names
    importances = pd.Series(model.feature_importances_, index=feature_names)

    # Sort and get the top N
    top_features = importances.sort_values(ascending=False).head(rules_N).reset_index()

    top_features.columns = ["feature", "importance"]

    return {
        "accuracy": float(accuracy_score(y_test, preds)),
        "top_n_rules": top_features.to_dict(orient="records"),
        "model_summary": {
            "type": "RandomForestClassifier",
            "max_depth": max_depth,
            "n_estimators": model.n_estimators,
            "feature_count": len(feature_names)
        }
    }
