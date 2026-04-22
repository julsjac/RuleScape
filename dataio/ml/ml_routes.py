from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from dataio.ml.runner import run_full_ml

router = APIRouter()
LAST_ML_RESULT: dict[str, Any] | None = None


class MLRunRequest(BaseModel):
    evalName: str
    groupId: str
    ruleGroupId: str
    models: List[str]
    train_split: float
    top_n_features: int
    threshold: float


@router.post("/run-ml")
def run_ml(request: MLRunRequest):
    global LAST_ML_RESULT

    request_payload = request.dict()
    result = run_full_ml(request_payload)
    LAST_ML_RESULT = {
        "status": "completed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "input": request_payload,
        **result,
    }
    return LAST_ML_RESULT


@router.get("/ml/result/latest")
def get_latest_ml_result():
    if LAST_ML_RESULT is None:
        raise HTTPException(status_code=404, detail="No ML results are available yet.")
    return LAST_ML_RESULT
