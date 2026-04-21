from dataio.knox.client import rule_evaluate
from dataio.ml.pipeline import run_ml_pipeline


def run_full_ml(payload):
    eval_name = payload["evalName"]
    group_id = payload["groupID"]
    rule_group_id = payload["ruleGroupID"]

    selected_models = payload["models"]
    params = payload["params"]

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
