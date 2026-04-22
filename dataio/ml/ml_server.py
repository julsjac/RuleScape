from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dataio.ml.ml_routes import router

app = FastAPI()

app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_methods=["*"],
      allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
      import uvicorn
      uvicorn.run(app, host="127.0.0.1", port=8000)
