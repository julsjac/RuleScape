import requests
import json
import pandas as pd

BASE_URL = "http://127.0.0.1:8080"

def rule_evaluate(eval_name, group_id, rule_group_id, labeling_method="sign"):
    url = (
        f"{BASE_URL}/rule/evaluate?"
        f"evaluationName={eval_name}&"
        f"designGroupID={group_id}&"
        f"rulesGroupID={rule_group_id}&"
        f"labelingMethod={labeling_method}"
    )

    response = requests.post(url)
    response.raise_for_status()

    return response.json()
    
from dataio.ml.pipeline import run_ml_pipeline

def getRuleEvaluation(eval_name):
    response = requests.get(
        BASE_URL + "/rule/getEvaluation?evaluationName=" + eval_name
    )
    response.raise_for_status()
    return processRuleEval(response)

def processRuleEval(response):
    json_data = json.loads(response.text)

    purity_metrics_df = pd.DataFrame(json_data["evaluationResults"]).T

    designToRule_df = pd.DataFrame(
        json_data["designToRule"],
        index=json_data["designToRule"]["designIDs"]
    )

    cols = designToRule_df.columns.to_list()
    cols.remove("labels")
    cols.remove("scores")
    cols.remove("designIDs")

    cols = ["labels", "scores"] + cols
    designToRule_df = designToRule_df[cols]

    return (
        purity_metrics_df.sort_values("impact"),
        designToRule_df.sort_values("scores"),
        json_data
    )

def run_full_ml(payload):
    eval_name = payload.get("evalName")
    group_id = payload.get("groupId")
    rule_group_id = payload.get("ruleGroupId")

    selected_models = payload.get("models", [])
    train_split = payload.get("train_split")
    top_n_features = payload.get("top_n_features")
    threshold = payload.get("threshold")
    

    _, design_df, _ = getRuleEvaluation(eval_name)

    results, features = run_ml_pipeline(
        design_df,
        train_split,
        top_n_features,
        selected_models
    )

    return {
        "results": results,
        "features": features
    }
