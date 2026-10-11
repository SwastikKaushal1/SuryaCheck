FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py geo.py finance.py pairing.py reference.json ./
EXPOSE 8000
# 0.0.0.0 is inside the container; docker-compose only publishes it on 127.0.0.1.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
