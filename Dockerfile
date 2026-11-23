FROM node:22-alpine AS frontend
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY notebooks/Electricity_Ensembles.ipynb /app/static/Electricity_Ensembles.ipynb
COPY --from=frontend /ui/dist/ /app/static/
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000","--workers","1"]
