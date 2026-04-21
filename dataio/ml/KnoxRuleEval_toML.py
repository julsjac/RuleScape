#!/usr/bin/env python
# coding: utf-8

# # Knox Design Analysis Notebook
# 
# Spring 2026
# 
# EC552 - Computational Synthetic Biology for Engineers

# Team Members Names: Rafay Adnan & Electra Scarpignato

# # Notes From James

# Depending on number of rules, the rule evaluation algorithm can take 10-30 minutes to run. Rule Evaluations are saved in Neo4j, so you do not
# need to rerun the rule evaluation algorithm, call getRuleEvaluation with the name of the evaluation (only 2-5 seconds to retrieve).
# 
# Run rule evaluations with:
# - ruleEvaluateByGroup
# - ruleEvaluateByDesigns
# 
# 
# Get rule evaluations with
# - getRuleEvaluation
# 
# 
# Delete rule evaluations with
# - deleteRuleEvaluation
# 
# 
# This notebook is to serve as a starting point for doing your analysis.
# 
# Feel free to change this notebook in any way you see fit.
# 

# In[ ]:





# In[8]:


pip install pandas


# In[9]:


pip install matplotlib


# In[12]:


pip install scikit-learn


# In[2]:


pip install xgboost


# In[8]:


pip install graphviz


# # Imports

# In[1]:


import requests
import csv
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import json

from sklearn import tree
from sklearn.model_selection import train_test_split
import xgboost as xgb


# # Knox Request Functions

# In[2]:


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



# # Decision Tree Functions

# In[ ]:


def exampleTree(X, y, **kwargs):
    # Mess around with different parameters

    dt_clf = tree.DecisionTreeClassifier(
        splitter=kwargs.get('splitter', 'best'),
        max_depth=kwargs.get('max_depth', None),
        min_samples_split=kwargs.get('min_samples_split', 400),
        min_samples_leaf=kwargs.get('min_samples_leaf', 200),
        max_features=kwargs.get('max_features', None),
        max_leaf_nodes=kwargs.get('max_leaf_nodes', None)
    )

    dt_clf = dt_clf.fit(X, y)

    return dt_clf

## Build more Trees, multiclassification and regression


# # Design Analysis

# ### Run RuleEvaluation

# In[ ]:


#deleteRuleEvaluation('test')


# In[8]:


# Use this for (gnn_predicted_scores.csv) designs already have the attached scores

evalName = 'ML2_rules_evaluation_4'
groupID = 'ML2_2'
ruleGroupID = 'ML2_rules3'

labelingMethod = 'sign'

purity_metrics_df, designToRule_df, json_data = ruleEvaluateByGroup(evalName, groupID, ruleGroupID, labelingMethod)


# ### View DataFrames

# In[15]:


print(json_data["evaluationResults"])


# In[6]:


purity_metrics_df, designToRule_df, json_data = getRuleEvaluation('ML2_rules_evaluation_4')


# In[7]:


purity_metrics_df


# In[8]:


designToRule_df


# ## Extract Features and Labels from designToRule_df

# In[9]:


feature_names = designToRule_df.columns.to_list()[2:]
X = designToRule_df.iloc[:, 2:].to_numpy(dtype=int)
y_labels = designToRule_df["labels"].to_numpy(dtype=int)
y_scores = designToRule_df["scores"].to_numpy(dtype=float)

# Compute quartile scores
Q1 = np.percentile(y_scores, 25)
Q2 = np.percentile(y_scores, 50)
Q3 = np.percentile(y_scores, 75)
print(f"Q1: {Q1}, Q2: {Q2}, Q3: {Q3}")
# Create a list of quartile scores where awful=0. poor=1, good=2, and great=3
y_quarts = []
for score in y_scores:
    if score < Q1:
        y_quarts.append(0)
    elif score < Q2:
        y_quarts.append(1)
    elif score < Q3:
        y_quarts.append(2)
    else:
        y_quarts.append(3)


# ## Train - Test Split

# In[10]:


# Split data into 70% training and 30% testing dependent on tree type

# Split for binary classification
X_train_bin, X_test_bin, y_train_bin, y_test_bin = train_test_split(
    X, y_labels, test_size=0.30, random_state=42)
# Split for regression
X_train_reg, X_test_reg, y_train_reg, y_test_reg = train_test_split(
    X, y_scores, test_size=0.30, random_state=42)
# Split for multiclass
X_train_mult, X_test_mult, y_train_mult, y_test_mult = train_test_split(
    X, y_quarts, test_size=0.30, random_state=42)


# ## Build Trees

# In[11]:


from sklearn import tree
from sklearn.metrics import r2_score
from sklearn.metrics import accuracy_score


# In[12]:


# Building a binary classification tree
from sklearn import tree
from sklearn.metrics import r2_score
from sklearn.metrics import accuracy_score
clf_bin = tree.DecisionTreeClassifier(max_depth=4)
clf_bin = clf_bin.fit(X_train_bin, y_train_bin)
# Predict test data nd retrieve accuracy
y_pred_bin = clf_bin.predict(X_test_bin)
accu_bin = accuracy_score(y_test_bin, y_pred_bin)
print(f'binary accuracy: {accu_bin}')

# Building a regression classification tree
clf_reg = tree.DecisionTreeRegressor(max_depth=5)
clf_reg = clf_reg.fit(X_train_reg, y_train_reg)
# Predict test data nd retrieve accuracy
y_pred_reg = clf_reg.predict(X_test_reg)
accu_reg = r2_score(y_test_reg, y_pred_reg)
print(f'regression R2: {accu_reg}')

# Building a multi-class classification tree
clf_mult = tree.DecisionTreeClassifier(max_depth=5)
clf_mult = clf_mult.fit(X_train_mult, y_train_mult)
# Predict test data nd retrieve accuracy
y_pred_mult = clf_mult.predict(X_test_mult)
accu_mult = accuracy_score(y_test_mult, y_pred_mult)
print(f'multi-class accuracy: {accu_mult}')


# In[32]:


xgb_model = xgb.XGBClassifier(objective="binary:logistic", random_state=42, eval_metric="auc")
xgb_model.fit(X_train_bin, y_train_bin, eval_set=[(X_test_bin, y_test_bin)])

y_pred_xgb = xgb_model.predict(X_test_bin)

accu_bin = accuracy_score(y_test_bin, y_pred_xgb)
print(f'xgb binary accuracy: {accu_bin}')
#print(confusion_matrix(y, y_pred))


# In[35]:


# print(feature_names)


# In[15]:


import os
os.system("dot -V")


# In[19]:


import os
os.environ["PATH"] += ";C:\\Program Files\\Graphviz\\bin"
import shutil
print(shutil.which("dot"))


# In[34]:


# converts the target tree to a graphviz instance
booster = xgb_model.get_booster()
graphxgb = xgb.to_graphviz(xgb_model, tree_idx=len(booster.get_dump()) - 1)
from xgboost import to_graphviz
graphxgb.render("xgb_tree", format="png")

# Gets top features
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

top_n = importance_df.head(10)
print(top_n)


# In[29]:


# Random Forest
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
clf_rf = RandomForestClassifier(max_depth=2, random_state=0)
clf_rf.fit(X_train_bin, y_train_bin)
y_pred_rf = clf_rf.predict(X_test_bin)

accu_bin = accuracy_score(y_test_bin, y_pred_rf)
print(f'rf binary accuracy: {accu_bin}')


# In[25]:


# print(feature_names)


# In[30]:


# 2. Extract importances and pair with feature names
importances = pd.Series(clf_rf.feature_importances_, index=feature_names)

# 3. Sort and get the top 10
top_features = importances.sort_values(ascending=False).head(20)
print(top_features)


# In[ ]:


# LASSO


# In[ ]:


# Logistuc Regression


# ## Plot Trees

# In[33]:


from sklearn.tree import plot_tree

# Note, depth was intentionally decreased for better tree visibility

# Plot a binary tree
fig_bin = plt.figure(figsize=(20,12))
plot_tree(clf_bin, filled=True, feature_names=designToRule_df.columns[2:].to_list(), fontsize=6, class_names=["bad","good"])
plt.title("Binary Decision tree trained on 70% data")
plt.show()

# Plot regression tree
fig_reg= plt.figure(figsize=(40,20))
plot_tree(clf_reg, filled=True, feature_names=designToRule_df.columns[2:].to_list(), fontsize=6)
plt.title("Regression Decision tree trained on 70% data")
plt.show()

# Plot Multi-class tree
fig_mult = plt.figure(figsize=(50,20))
plot_tree(clf_mult, filled=True, feature_names=designToRule_df.columns[2:].to_list(), fontsize=6, class_names=["awful","poor","good","great"])
plt.title("Multi-class Decision tree trained on 70% data")
plt.show()


# ## Save Trees

# In[34]:


fig_bin.savefig('ML2 Binary Decision Tree.png')
fig_reg.savefig('ML2 Regression Decision Tree.png')
fig_mult.savefig('ML2 Multi-Class Decision Tree.png')


# ## Save Purity Metrics and DesignToRule DF to CSV

# In[5]:


# Export Dataframes to csv
designToRule_df.to_csv('designToRule_ML2_ID.csv',index=False)
purity_metrics_df.to_csv('purity_metrics_ML2.csv',index=False)


# # Deliverables

# 1. How many rules did you use? Why did you choose those rules?
# 299 rules were used. We chose these rules to assess how:
# * The presence or absence of particular promoters affected results: So we added rules on the exclusion and inclusion of every promoter
# * The presence or absence of particular cds affected results: So we added rules on the exclusion and inclusion of every cds (except Y because it was always at the end of the designs)
# * Every combination of promoter with cds effected results: So we added rules for every promoter to CDS combination
# * The starting promoter affects results: So we made rules for every promoter at the start
# * Pairwise interactions between promoters affect results: So we made rules for the inclusion and exclusion of every possible promoter pairing, and we made rules for the occurrence of every promoter before another to assess the effect of ordering relationships
# 
#    
# 3. What are we learning from each type of tree?
# Firstly, by  looking at the performance of the tree models, ie. accuracy, we can assess how well an input set of rules splits a design space into outcome bins. Second, by looking at the splitting of each tree, we can see how different rules and combinations of rules affect outcomes. From the binary tree, for instance, we see that rules regarding the pairing of promoters and cds play a large role in classification.
# 
# 4. What are some interesting insights you noticed about some of the rules?
# Across all tree types, the promoter:cds combinations played a large role in initially dividing the sample space. In the binary tree it was interesting to see that the combination of just 3 rules (Promoters PP2 and PS1 occurring together, promoter P1 pairing with cds F, and cds S1 not being included) resulted in a bin of 1018 good desings and 12 bad designs, indicating that they largely divide the space in combination
# 
# 5. If you were to experimentally validate five of these rules, which would you choose? 
# Why?
# I would choose rules that result in the largest splitting of the space into good designs, for instance the rules mentioned of Promoters PP2 and PS1 occurring together, promoter Pln1 pairing with cds P1, and cds S1 not being included splits into good designs. It looks like in the regression tree that rule promoter PP2 occuring before cds H1 also largely splits the space into well-performing designs. Looking at the multiclass tree, it looks like rule promoter PB2 paired with cds 
# 
# 7. Submit your final Jupyter Notebook and PDF of the Jupyter Notebook on Blackboard.
# 
# 8. Submit each plotted tree “.png” on Blackboard.
# 
# 9. Submit GOLDBAR Generator CSV file on BlackBoard.
# 
# 10. Submit DataFrame CSV files on BlackBoard. 
