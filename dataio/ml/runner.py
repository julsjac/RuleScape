from dataio.knox.client import rule_evaluate
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
        params,
        selected_models
    )

    return {
        "results": results,
        "features": features
    }
