"""AWS Lambda entry point (infra/template.yaml: Handler lambda_handler.handler).

Vercel, Docker and `uvicorn main:app` serve the FastAPI app directly; only Lambda needs this wrapper.
"""
from mangum import Mangum

from main import app

handler = Mangum(app, lifespan="off")
