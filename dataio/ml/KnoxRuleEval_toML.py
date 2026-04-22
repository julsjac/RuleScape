#!/usr/bin/env python
# coding: utf-8

# Rule Scoring Pipeline

#Install Dependencies - will change to separate requirements.txt
pip install pandas
pip install matplotlib
pip install scikit-learn
pip install xgboost
pip install graphviz


# # Library Imports

import requests
import csv
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import json

from sklearn import tree
from sklearn.model_selection import train_test_split
import xgboost as xgb


# # Knox Request Functions and rule evaluation functions

url = 'http://localhost:8080'

def ruleEvaluateByGroup(evalName, groupID, ruleGroupID, labelingMethod="sign"):
    """
    API Request to Knox to run Rule Evaluation Algorithm.

    Returns:
    metrics (list of pandas DataFrames): purity_metrics, designToRule
    """
    response = requests.post(url + '/rule/evaluate?' + 
                             "evaluationName=" + evalName + '&' + 
                             "designGroupID=" + groupID + '&' +
                             "rulesGroupID=" + ruleGroupID + '&' +
                             "labelingMethod=" + labelingMethod
    )

    return processRuleEval(response)


def ruleEvaluateByDesigns(evalName, designIDs, ruleGroupID, designScores, labelingMethod="sign"):
    designSpaceIDs = listToStringList(designIDs)
    designScoresStr = listToStringList(designScores) # designScores should be a list of strings, may have to convert floats to strings before running

    # Submit Request
    response = requests.post(url + '/rule/evaluate?' + 
                             "evaluationName=" + evalName + '&' + 
                             "designSpaceIDs=" + designSpaceIDs + '&' + 
                             "rulesGroupID=" + ruleGroupID + '&' + 
                             "designScores=" + designScoresStr + '&' + 
                             "labelingMethod=" + labelingMethod
    )

    return processRuleEval(response)


def getRuleEvaluation(evalName):
    response = requests.get(url + '/rule/getEvaluation?' + "evaluationName=" + evalName)

    return processRuleEval(response)


def deleteRuleEvaluation(evalName):
    response = requests.delete(url + '/rule?' + "evaluationName=" + evalName)

    if not response.text:
        return f'"{evalName}" Sucessfully Deleted'
    else:
        return response.text


def processRuleEval(response):
    # Change to Pandas DataFrame
    json_data = json.loads(response.text)

    purity_metrics_df = pd.DataFrame(json_data["evaluationResults"]).T

    designToRule_df = pd.DataFrame(json_data["designToRule"], index=json_data["designToRule"]["designIDs"])
    cols = designToRule_df.columns.to_list()
    cols.remove("labels")
    cols.remove("scores")
    cols.remove("designIDs")
    cols = ["labels", "scores"] + cols
    designToRule_df = designToRule_df[cols]

    # print("COLUMNS:", purity_metrics_df.columns)
    # print(purity_metrics_df.head())
    # print(json_data["evaluationResults"])

    return purity_metrics_df.sort_values("impact"), designToRule_df.sort_values("scores"), json_data


def listToStringList(list_input):
    return ",".join(list_input)


evalName = 'ML2_rules_evaluation_4'
groupID = 'ML2_2'
ruleGroupID = 'ML2_rules3'

labelingMethod = 'sign'

purity_metrics_df, designToRule_df, json_data = ruleEvaluateByGroup(evalName, groupID, ruleGroupID, labelingMethod)


### View DataFrames

purity_metrics_df, designToRule_df, json_data = getRuleEvaluation('ML2_rules_evaluation_4')

purity_metrics_df
designToRule_df


# ## Extract Features and Labels from designToRule_df
feature_names = designToRule_df.columns.to_list()[2:]
X = designToRule_df.iloc[:, 2:].to_numpy(dtype=int)
y_labels = designToRule_df["labels"].to_numpy(dtype=int)
y_scores = designToRule_df["scores"].to_numpy(dtype=float)

# Compute quartile scores
Q1 = np.percentile(y_scores, 25)
Q2 = np.percentile(y_scores, 50)
Q3 = np.percentile(y_scores, 75)
print(f"Q1: {Q1}, Q2: {Q2}, Q3: {Q3}")

## Train - Test Split

# Split for binary classification
X_train_bin, X_test_bin, y_train_bin, y_test_bin = train_test_split(
    X, y_labels, test_size=0.30, random_state=42)
# Split for regression
X_train_reg, X_test_reg, y_train_reg, y_test_reg = train_test_split(
    X, y_scores, test_size=0.30, random_state=42)


# ## Build Trees

# In[11]:


from sklearn import tree
from sklearn.metrics import r2_score
from sklearn.metrics import accuracy_score


## Building a binary classification tree
from sklearn import tree
from sklearn.metrics import r2_score
from sklearn.metrics import accuracy_score
clf_bin = tree.DecisionTreeClassifier(max_depth=4)
clf_bin = clf_bin.fit(X_train_bin, y_train_bin)
# Predict test data nd retrieve accuracy
y_pred_bin = clf_bin.predict(X_test_bin)
accu_bin = accuracy_score(y_test_bin, y_pred_bin)
print(f'binary accuracy: {accu_bin}')


## Building a regression classification tree
clf_reg = tree.DecisionTreeRegressor(max_depth=5)
clf_reg = clf_reg.fit(X_train_reg, y_train_reg)
# Predict test data nd retrieve accuracy
y_pred_reg = clf_reg.predict(X_test_reg)
accu_reg = r2_score(y_test_reg, y_pred_reg)
print(f'regression R2: {accu_reg}')


## Build and run XGBoost Model
xgb_model = xgb.XGBClassifier(objective="binary:logistic", random_state=42, eval_metric="auc")
xgb_model.fit(X_train_bin, y_train_bin, eval_set=[(X_test_bin, y_test_bin)])

y_pred_xgb = xgb_model.predict(X_test_bin)

accu_bin = accuracy_score(y_test_bin, y_pred_xgb)
print(f'xgb binary accuracy: {accu_bin}')


## Retrieves top features from the XGB Model
booster = xgb_model.get_booster()
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
print(top_n)

# Build Random Forest
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
clf_rf = RandomForestClassifier(max_depth=3, random_state=0)
clf_rf.fit(X_train_bin, y_train_bin)
y_pred_rf = clf_rf.predict(X_test_bin)

accu_bin = accuracy_score(y_test_bin, y_pred_rf)
print(f'rf binary accuracy: {accu_bin}')

# 2. Extract importances and pair with feature names
importances = pd.Series(clf_rf.feature_importances_, index=feature_names)

# 3. Sort and get the top 10
top_features = importances.sort_values(ascending=False).head(rules_N)
print(top_features)

### Plot Trees
from sklearn.tree import plot_tree
# Note, depth was intentionally decreased for better tree visibility
fig_bin = plt.figure(figsize=(20,12))
plot_tree(clf_bin, filled=True, feature_names=designToRule_df.columns[2:].to_list(), fontsize=6, class_names=["bad","good"])
plt.title("Binary Decision tree trained on 70% data")
plt.show()

# Plot regression tree
fig_reg= plt.figure(figsize=(40,20))
plot_tree(clf_reg, filled=True, feature_names=designToRule_df.columns[2:].to_list(), fontsize=6)
plt.title("Regression Decision tree trained on 70% data")
plt.show()

fig_bin.savefig('ML Binary Decision Tree.png')
fig_reg.savefig('ML Regression Decision Tree.png')

# Export Dataframes to csv
designToRule_df.to_csv('designToRule_ML2_ID.csv',index=False)
purity_metrics_df.to_csv('purity_metrics_ML2.csv',index=False)

