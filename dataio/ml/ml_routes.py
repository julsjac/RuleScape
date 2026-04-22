from fastapi import APIRouter
from dataio.ml.runner import run_full_ml
from .models import MLRunRequest  # adjust import path as needed

router = APIRouter()

@router.post("/ml/run")
def run_ml(request: MLRunRequest):
        result = run_full_ml(request.dict())
        return result
