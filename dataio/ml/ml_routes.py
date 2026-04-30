# Defines the API routes for the ML service.
# Imported and registered by ml_server.py via app.include_router(router).

from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from dataio.ml.runner import run_full_ml

# In-memory cache of the most recent ML run result.
# Persists for the lifetime of the server process; resets on restart.
router = APIRouter()
LAST_ML_RESULT: dict[str, Any] | None = None

# Pydantic model for validating the POST /run-ml request body.
# All fields are required and come directly from the frontend UI form.
class MLRunRequest(BaseModel):
    evalName: str           # Name of the Knox rule evaluation to load
    groupId: str            # Knox design group ID
    ruleGroupId: str        # Knox rules group ID
    models: List[str]       # Which models to run: "xgb", "rf", "dt_bin", "dt_reg"
    train_split: float      # Train/test split percentage (e.g. 80 = 80% train)
    top_n_features: int     # Number of top features to report per model
    threshold: float        # Score threshold for binary labeling (passed through to runner)


@router.post("/run-ml")
def run_ml(request: MLRunRequest):
    # Triggers a full ML pipeline run.
    # Fetches rule evaluation data from Knox, trains the selected models,
    # and returns results + feature importances.
    # Also caches the result in LAST_ML_RESULT for retrieval via GET /ml/result/latest.
    global LAST_ML_RESULT

    request_payload = request.dict()
    result = run_full_ml(request_payload)
    # Wrap raw results with metadata before returning and caching
    LAST_ML_RESULT = {
        "status": "completed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "input": request_payload,
        **result,
    }
    return LAST_ML_RESULT


@router.get("/ml/result/latest")
def get_latest_ml_result():
    # Returns the cached result from the most recent /run-ml call.
    # Useful for the frontend to re-fetch results without re-running the pipeline.
    # Returns 404 if no run has been triggered yet this session.
    if LAST_ML_RESULT is None:
        raise HTTPException(status_code=404, detail="No ML results are available yet.")
    return LAST_ML_RESULT
