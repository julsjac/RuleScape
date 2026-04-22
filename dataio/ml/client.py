import requests
import json
import pandas as pd

BASE_URL = "http://localhost:8080"


def rule_evaluate(eval_name, group_id, rule_group_id, labeling_method="median"):
    response = requests.post(
        f"{BASE_URL}/rule/evaluate",
        params={
            "evaluationName": eval_name,
            "designGroupID": group_id,
            "rulesGroupID": rule_group_id,
            "labelingMethod": labeling_method
        }
    )
    return _process(response)


def get_evaluation(eval_name):
    response = requests.get(
        f"{BASE_URL}/rule/getEvaluation",
        params={"evaluationName": eval_name}
    )
    return _process(response)


def _process(response):
    json_data = json.loads(response.text)

    purity_df = pd.DataFrame(json_data["evaluationResults"]).T

    design_df = pd.DataFrame(
        json_data["designToRule"],
        index=json_data["designToRule"]["designIDs"]
    )

    cols = design_df.columns.tolist()
    cols.remove("labels")
    cols.remove("scores")
    cols.remove("designIDs")

    design_df = design_df[["labels", "scores"] + cols]

    return (
        purity_df.sort_values("impact"),
        design_df.sort_values("scores"),
        json_data
    )
