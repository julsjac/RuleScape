from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score


def train(X_train, y_train, X_test, y_test, max_depth=3):
    model = RandomForestClassifier(max_depth=max_depth, random_state=0)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    return {
        "model": model,
        "accuracy": accuracy_score(y_test, preds)
    }
