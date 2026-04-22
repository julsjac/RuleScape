from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from dataio.ml.runner import run_full_ml

router = APIRouter()

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
            result = run_full_ml(request.dict())
            return result
