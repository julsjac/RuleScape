# Bridges ml_routes.py and pipeline.py.
# Responsible for fetching rule evaluation data from Knox, formatting it,
# and handing it off to the ML pipeline. Also handles JSON serialization of results.
import requests
import json
import numpy as np
import pandas as pd

def to_json_safe(obj):
    # Converts numpy and pandas types to native python types to safely serialize to JSON and FastAPI
    
    # pandas DataFrame
    if isinstance(obj, pd.DataFrame):
        return obj.to_dict(orient="records")

    # pandas Series
    if isinstance(obj, pd.Series):
        return obj.to_dict()

    # numpy scalar
    if isinstance(obj, np.generic):
        return obj.item()

    # numpy array
    if isinstance(obj, np.ndarray):
        return obj.tolist()

    # dict → recursively clean values
    if isinstance(obj, dict):
        return {str(k): to_json_safe(v) for k, v in obj.items()}

    # list / tuple → recursively clean items
    if isinstance(obj, (list, tuple)):
        return [to_json_safe(v) for v in obj]

    # fallback
    return obj

# Knox REST API base URL — must be running locally before the ML server is started
BASE_URL = "http://127.0.0.1:8080"

def rule_evaluate(eval_name, group_id, rule_group_id, labeling_method="sign"):
    # Triggers a new rule evaluation in Knox by POSTing to its /rule/evaluate endpoint.
    # Knox will score designs against the specified rule group and store the result
    # under eval_name for later retrieval.

    # NOTE: This function is not called in the current run_full_ml flow — Knox evaluations
    # are assumed to already exist. This is available for manual or future use.
    
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
    # Fetches previously stored rule evaluation from Knox
    response = requests.get(
        BASE_URL + "/rule/getEvaluation?evaluationName=" + eval_name
    )
    response.raise_for_status()
    return processRuleEval(response)

def processRuleEval(response):
    # Oarses raw Knox evalutation into structured dataframe for the ML
    
    json_data = response.json()

    # Transpose so rules are rows (each row = one rule's purity metrics)
    purity_metrics_df = pd.DataFrame(json_data["evaluationResults"]).T

    designToRule_df = pd.DataFrame(
        json_data["designToRule"],
        index=json_data["designToRule"]["designIDs"]
    )

    # Reorder columns so labels and scores come first, followed by rule feature columns.
    # pipeline.py's build_xy() depends on this layout (it slices from column index 2 onward).
    cols = designToRule_df.columns.to_list()
    cols.remove("labels")
    cols.remove("scores")
    cols.remove("designIDs")

    cols = ["labels", "scores"] + cols
    designToRule_df = designToRule_df[cols]

    return {
        "evaluationResults": purity_metrics_df.sort_values("impact").to_dict(orient="records"),
        "designToRule": designToRule_df.sort_values("scores").to_dict(orient="records"),
        "raw": json_data
    }

def run_full_ml(payload):
    # Main entry point called by ml_routes.py.
    # Fetches the Knox rule evaluation, builds the design DataFrame,
    # runs the selected ML models, and returns JSON-safe results.
    eval_name = payload.get("evalName")
    group_id = payload.get("groupId")
    rule_group_id = payload.get("ruleGroupId")

    selected_models = payload.get("models", [])
    train_split = payload.get("train_split")
    top_n_features = payload.get("top_n_features")
    # Fetch and format the Knox evaluation data
    eval_result = getRuleEvaluation(eval_name)

    # Reconstruct the designToRule DataFrame for pipeline ingestion
    design_df = pd.DataFrame(eval_result["designToRule"])

    # train_split arrives as a percentage (e.g. 80) — divide by 100 before passing to sklear
    results, features = run_ml_pipeline(
        design_df,
        (train_split/100),
        top_n_features,
        selected_models
    )

    # Convert numpy/pandas types to native Python before JSON serialization.
    # The double json.loads(json.dumps(...)) pass ensures any edge cases are caught.
    results_safe = to_json_safe(results)
    features_safe = to_json_safe(features)

    return {
        "results": json.loads(json.dumps(results_safe)),
        "features": json.loads(json.dumps(features_safe))
    }
