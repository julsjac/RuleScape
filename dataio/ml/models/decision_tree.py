import numpy as np
from sklearn import tree
from sklearn.metrics import accuracy_score, r2_score


def train_classifier(X_train, y_train, X_test, y_test, rules_N, feature_names):
    max_depth = 8
    model = tree.DecisionTreeClassifier(max_depth=max_depth)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    # Extract feature importances
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1][:rules_N]
    top_features = [
        {"feature": feature_names[i], "importance": float(importances[i])}
        for i in indices
    ]

    return {
        "accuracy": float(accuracy_score(y_test, preds)),
        "top_n_rules": top_features,
        "model_summary": {
            "type": "BinaryDecisionTree",
            "max_depth": max_depth,
            "feature_count": len(feature_names),
        }
    }


def train_regressor(X_train, y_train, X_test, y_test, rules_N, feature_names):
    max_depth = 8
    model = tree.DecisionTreeRegressor(max_depth=max_depth)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    # Extract feature importances
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1][:rules_N]
    top_features = [
        {"feature": feature_names[i], "importance": float(importances[i])}
        for i in indices
    ]

    return {
        "r2": float(r2_score(y_test, preds)),
        "top_n_rules": top_features,
        "model_summary": {
            "type": "RegressionDecisionTree",
            "max_depth": max_depth,
            "feature_count": len(feature_names)
        }
    }
