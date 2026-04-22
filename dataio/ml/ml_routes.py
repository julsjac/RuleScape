from fastapi import APIRouter
from dataio.ml.runner import run_full_ml
from .models import MLRunRequest  # adjust import path as needed

router = APIRouter()

@router.post("/ml/run")
def run_ml(request: MLRunRequest):
    result = run_full_ml(
        train_split=request.train_split,
        top_n_features=request.top_n_features,
        threshold=request.threshold,
    )
    return result
