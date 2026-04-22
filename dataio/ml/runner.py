import requests

KNOX_URL = "http://127.0.0.1:8080"

def rule_evaluate(payload: dict):
    response = requests.post(
        f"{KNOX_URL}/evaluate",
        json=payload,
        timeout=60
    )
    response.raise_for_status()
    return response.json()
    
from dataio.ml.pipeline import run_ml_pipeline


def run_full_ml(payload):
    eval_name = payload.get("evalName")
    group_id = payload.get("groupId")
    rule_group_id = payload.get("ruleGroupId")

    selected_models = payload.get("models", [])
    train_split = payload.get("train_split")
    top_n_features = payload.get("top_n_features")
    threshold = payload.get("threshold")
    

    _, design_df, _ = rule_evaluate(
        eval_name,
        group_id,
        rule_group_id
    )

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
