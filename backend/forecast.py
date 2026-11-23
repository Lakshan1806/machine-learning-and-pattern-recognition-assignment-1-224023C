"""AI code credit: OpenAI ChatGPT (Codex), 22 November 2026.
Generated ingestion, feature preparation, chronological evaluation and metrics.
Dataset: Algama et al., RECON-SL, DOI 10.21227/n1dk-q860, CC BY 4.0.
"""
import csv
import io
import math
import re
from collections import Counter
from datetime import date
from statistics import mean

MODELS = ["Last bill", "Random Forest", "XGBoost", "Stacking"]
FEATURES = ["last", "two_back", "three_back", "average", "month_sin", "month_cos"]


def month_number(value):
    # The release documents YYYY-MM. Accept a full ISO date as well.
    match = re.fullmatch(r"(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?", value.strip())
    if not match:
        raise ValueError("Invalid month")
    year, month, day = match.groups()
    parsed = date(int(year), int(month), int(day or 1))
    return parsed.year * 12 + parsed.month - 1


def label(number):
    year, index = divmod(number, 12)
    return f"{year:04d}-{index + 1:02d}"


def read_bills(content):
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    columns = {re.sub(r"[^a-z0-9]", "", key.lower()): key for key in reader.fieldnames or []}
    required = ["householdid", "month", "consumption"]
    if any(key not in columns for key in required):
        raise ValueError(f"Expected household_Id, month, consumption. Found {reader.fieldnames}.")
    bills, conflicts, audit = {}, set(), Counter()
    for row in reader:
        audit["Input rows"] += 1
        household, month, value = [(row.get(columns[key]) or "").strip() for key in required]
        try:
            period = month_number(month)
            units = float(value.replace(",", ""))
            if not household or not math.isfinite(units) or units < 0:
                raise ValueError
        except ValueError:
            audit["Invalid rows skipped"] += 1
            continue
        key = (household, period)
        if key in bills:
            if bills[key] != units:
                conflicts.add(key)
            else:
                audit["Matching duplicate rows"] += 1
        else:
            bills[key] = units
    for key in conflicts:
        del bills[key]
    audit["Conflicting household-months excluded"] = len(conflicts)
    audit["Usable household-months"] = len(bills)
    return bills, dict(audit)


def make_examples(bills):
    rows = []
    for (household, period), actual in sorted(bills.items()):
        history = [bills.get((household, period - offset)) for offset in (1, 2, 3)]
        if None in history:
            continue
        phase = 2 * math.pi * (period % 12) / 12
        rows.append(dict(household=household, period=period, actual=actual,
                         last=history[0], two_back=history[1], three_back=history[2],
                         average=mean(history), month_sin=math.sin(phase), month_cos=math.cos(phase)))
    return rows


def partition(rows):
    periods = sorted({row["period"] for row in rows})
    if len(periods) < 8:
        raise ValueError("Need at least eight eligible target months after forming three consecutive lag months.")
    test_start = periods[-3]
    cal_start = periods[-6]
    fit = [r for r in rows if r["period"] < cal_start]
    cal = [r for r in rows if cal_start <= r["period"] < test_start]
    test = [r for r in rows if r["period"] >= test_start]
    return fit, cal, test


def train_and_test(rows):
    import numpy as np
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import Ridge
    from xgboost import XGBRegressor

    def inputs(group):
        return np.array([[r[name] for name in FEATURES] for r in group])

    def train_pair(group):
        x, y = inputs(group), [r["actual"] for r in group]
        forest = RandomForestRegressor(n_estimators=100, max_depth=12, max_features=0.8,
                                       min_samples_leaf=5, n_jobs=2, random_state=42)
        boost = XGBRegressor(n_estimators=150, max_depth=3, learning_rate=0.05,
                             objective="reg:squarederror", tree_method="hist", n_jobs=2, random_state=42)
        return forest.fit(x, y), boost.fit(x, y)

    def predictions(models, group):
        x = inputs(group)
        return np.maximum(0, np.column_stack([model.predict(x) for model in models]))

    fit, cal, test = partition(rows)
    calibration_predictions = predictions(train_pair(fit), cal)
    meta = Ridge(alpha=1.0).fit(calibration_predictions, [r["actual"] for r in cal])
    # Same final base models serve standalone and stacked predictions.
    final_models = train_pair(fit + cal)
    base = predictions(final_models, test)
    stacked = np.maximum(0, meta.predict(base))
    results = []
    for row, (rf, xgb), stack in zip(test, base, stacked):
        values = [row["last"], float(rf), float(xgb), float(stack)]
        results.append({**row, **dict(zip(MODELS, values)), "month": label(row["period"])})
    splits = [{"Stage": name, "First month": label(min(r["period"] for r in group)),
               "Last month": label(max(r["period"] for r in group)), "Bills": len(group)}
              for name, group in zip(["Initial fit", "Stack calibration", "Final test"], (fit, cal, test))]
    importance = dict(zip(FEATURES, map(float, final_models[1].feature_importances_)))
    return results, splits, importance


def scores(results):
    table = []
    actual_mean = mean(row['actual'] for row in results)
    total = sum((row['actual'] - actual_mean) ** 2 for row in results)
    for model in MODELS:
        errors = [row[model] - row["actual"] for row in results]
        table.append({"Model": model, "MAE (kWh)": mean(abs(e) for e in errors),
                      "R2": 1 - sum(e * e for e in errors) / total if total else None,
                      "RMSE (kWh)": math.sqrt(mean(e * e for e in errors))})
    return sorted(table, key=lambda item: item["MAE (kWh)"])

