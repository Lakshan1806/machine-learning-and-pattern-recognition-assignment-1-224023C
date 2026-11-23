"""AI code credit: OpenAI ChatGPT (Codex), 22 November 2026. API, cache and startup."""
import hashlib
import json
import logging
from random import Random
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock, Thread

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from .forecast import MODELS, label, make_examples, read_bills, scores, train_and_test

CACHE = Path("/cache")
INPUT = Path("/input/monthly_consumption.csv")
lock = Lock()
status = {"phase": "starting", "message": "Starting the dashboard"}
report = None


def update(phase, message):
    with lock:
        status.update(phase=phase, message=message)


def atomic_write(path, content):
    temp = path.with_suffix(".tmp")
    temp.write_bytes(content)
    temp.replace(path)


def prepare():
    global report
    try:
        CACHE.mkdir(exist_ok=True)
        try:
            content = INPUT.read_bytes()
        except OSError as error:
            raise ValueError("Cannot read data/monthly_consumption.csv. Check the file and its permissions.") from error
        signature = hashlib.sha256(content + Path(__file__).with_name("forecast.py").read_bytes()
                                   + Path(__file__).read_bytes()
                                   + Path("/app/requirements.txt").read_bytes()).hexdigest()
        results_file = CACHE / "results.json"
        ready = None
        if results_file.is_file():
            try:
                existing = json.loads(results_file.read_bytes())
                if existing["signature"] == signature:
                    ready = existing["report"]
            except (KeyError, ValueError):
                pass
        if ready is None:
            update("training", "Training and evaluating the models on chronological billing records")
            bills, audit = read_bills(content)
            rows = make_examples(bills)
            predictions, splits, importance = train_and_test(rows)
            households = {}
            for r in predictions:
                history = [{"month": label(r["period"]-i), "kwh": r[key]}
                           for i, key in [(3,"three_back"),(2,"two_back"),(1,"last")]]
                households.setdefault(r["household"], []).append({
                    "month": r["month"], "actual": r["actual"], "history": history,
                    "predictions": {model: r[model] for model in MODELS}})
            sample = Random(42).sample(predictions, min(1000, len(predictions)))
            points = [[r['actual'], r['Stacking']] for r in sample]
            ready = {"comparison": {"points": points, "importance": importance,
                                    "scores": scores(predictions), "splits": splits,
                     "audit": audit, "eligible": len(rows), "bills": len(predictions),
                     "households": len(households)}, "households": households}
            atomic_write(results_file, json.dumps({"signature": signature, "report": ready},
                         allow_nan=False).encode())
        with lock:
            report = ready
            status.update(phase="ready", message="Evaluation complete")
    except Exception as error:
        logging.exception("Dashboard initialization failed")
        update("error", f"Could not complete the evaluation. {error}")


def start():
    with lock:
        if status["phase"] in {"loading", "training"}:
            raise HTTPException(409, "An evaluation is already running.")
        status.update(phase="loading", message="Reading monthly consumption data")
    Thread(target=prepare, daemon=True).start()


@asynccontextmanager
async def lifespan(app):
    start()
    yield


app = FastAPI(title="Ensemble Learning Dashboard", lifespan=lifespan)


@app.get("/api/status")
def get_status():
    with lock:
        return dict(status)


@app.post("/api/retry", status_code=202)
def retry():
    start()
    return {"accepted": True}


def current():
    with lock:
        if status["phase"] != "ready":
            raise HTTPException(503, status["message"])
        return report


@app.get("/api/comparison")
def comparison():
    return current()["comparison"]


@app.get("/api/households")
def list_households():
    return sorted(current()["households"])


@app.get("/api/bills")
def bills(household: str):
    found = current()["households"].get(household)
    if found is None:
        raise HTTPException(404, "Unknown household")
    return found


app.mount("/", StaticFiles(directory="/app/static", html=True), name="frontend")
