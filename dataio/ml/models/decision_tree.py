from sklearn import tree
from sklearn.metrics import accuracy_score, r2_score


def train_classifier(X_train, y_train, X_test, y_test):
    model = tree.DecisionTreeClassifier(max_depth=4)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    return {
        "model": model,
        "accuracy": accuracy_score(y_test, preds)
    }


def train_regressor(X_train, y_train, X_test, y_test):
    model = tree.DecisionTreeRegressor(max_depth=5)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    return {
        "model": model,
        "r2": r2_score(y_test, preds)
    }
