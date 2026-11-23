# Ensemble Learning Dashboard

Machine Learning and Pattern Recognition | Student index **224023C**

Household electricity forecasts with Random Forest, XGBoost and Stacking (Ridge regression).

## Run

Start Docker Desktop (Linux containers) or Docker Engine with Compose v2 or later. From the directory containing compose.yaml run:

```sh
docker compose up --build
```

Open **http://localhost:8000**. Leave the terminal running during the demo. Docker builds React with Vite, installs the Python environment and starts FastAPI, which serves both the React application and the API. No host Node, Python, database, API key or separate training command is required. The first build needs internet for images and dependencies.

## Data and first launch

Docker reads the project's `data/monthly_consumption.csv` through a read-only mount. If the file is missing or unreadable, restore it in that folder and select **Retry loading**. The Docker volume caches evaluation results. A change to the CSV, model code or backend requirements triggers a fresh evaluation on startup or retry.

Stop with Ctrl+C or `docker compose down`. The default address is local to the evaluator's machine. To select another port, set PORT in a .env file beside compose.yaml.

## Evaluation and demo

1. On **Compare model performance**, compare the MAE in kWh for the last-bill baseline, Random Forest, XGBoost and the ridge stack. Expand the metrics table for RMSE.
2. In **Explore household forecasts**, select an anonymised household and test month. Compare three prior bills, recorded consumption and each forecast's absolute error.
3. Use **How models are trained and tested** to inspect the real split dates and counts. The final three eligible months are reserved for testing. The preceding three supply calibration forecasts for the stack. Later test inputs can use already observed earlier bills, matching one-cycle-ahead forecasting. Metrics measure performance over participating LECO households in the historical test period.
4. Use **Download notebook** for the standalone submission notebook. Open it in Colab or a Jupyter-enabled IDE to inspect the implementation and save a copy with the outputs. Run it from the project root or the notebooks directory to use the project CSV. For a standalone run, place the same CSV in the notebook working directory. The Docker dashboard trains and evaluates the models itself without launching Jupyter. Interpret your own run in your presentation.

## Repository

- `frontend/` contains the React/Vite interface.
- `backend/forecast.py` contains ingestion, lag features, models and metrics.
- `backend/main.py` provides FastAPI endpoints, training and persistent results.
- `notebooks/Electricity_Ensembles.ipynb` contains the standalone Python implementation.
- `Dockerfile` builds frontend assets then copies them into the Python runtime image.
- `compose.yaml` configures the app, data mount, port and persistent cache.

The API documentation is available at **http://localhost:8000/docs**. The React frontend uses relative URLs so no CORS configuration is required. `GET /api/status` reports the job phase. `GET /api/comparison`, `GET /api/households` and `GET /api/bills?household=...` provide the evaluation results.

## References and code attribution

Algama et al. (2025), [Residential Electricity Consumption Dataset for Sri Lanka (RECON-SL)](https://doi.org/10.21227/n1dk-q860), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This project removes invalid or conflicting records, calculates consumption lags and evaluates chronological splits.

OpenAI ChatGPT (Codex), 22 November 2026, generated the React interface and styles, FastAPI backend, forecasting and evaluation code, notebook, Docker configuration and documentation following the student's assignment brief and design choices. The assignment requires the student's own model comparisons, interpretation and voiceover.
The comparison screen includes real split dates, paired MAE/RMSE bars, R², a stacking forecast scatterplot and XGBoost input importance. Up to 1,000 randomly selected test bills are plotted with a fixed seed. All test bills contribute to the scores. A constant test target gives an undefined R².
