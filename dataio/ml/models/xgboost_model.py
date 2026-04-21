import xgboost as xgb
from sklearn.metrics import accuracy_score


def train(X_train, y_train, X_test, y_test):
    model = xgb.XGBClassifier(
        objective="binary:logistic",
        random_state=42,
        eval_metric="auc"
    )

    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    return {
        "model": model,
        "accuracy": accuracy_score(y_test, preds)
    }
