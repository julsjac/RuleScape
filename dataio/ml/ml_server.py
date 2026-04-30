# Entry point for the ML microservice.
# Run with: python -m dataio.ml.ml_server  (or via uvicorn directly)
# Listens on http://127.0.0.1:8000 and exposes routes defined in ml_routes.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dataio.ml.ml_routes import router

app = FastAPI()

# Allow requests from the frontend dev server (Vite, port 5173).
# Origins/methods/headers are left open ("*") since this service
# only runs locally.
app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_methods=["*"],
      allow_headers=["*"],
)

# Register the ML routes (/run-ml, /ml/result/latest)
app.include_router(router)

if __name__ == "__main__":
      import uvicorn
      # Host bound to localhost only — not accessible outside the machine
      uvicorn.run(app, host="127.0.0.1", port=8000)
