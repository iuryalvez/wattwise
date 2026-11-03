"""Deterministic energy calculations and synthetic interval integration."""

import math


def number(value, field, *, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field} must be a number")
    if not math.isfinite(value) or value < 0 or (positive and value == 0):
        raise ValueError(f"{field} must be finite and {'positive' if positive else 'non-negative'}")
    return float(value)


def state_power(state):
    if ("watts" in state) == ("components" in state):
        raise ValueError("A state needs either watts or components, exclusively")
    if "watts" in state:
        return number(state["watts"], "watts")
    components = state["components"]
    if not isinstance(components, list) or not components:
        raise ValueError("components must be a non-empty list")
    return sum(number(c["watts"], "component watts") for c in components)


def schedule(states):
    if not isinstance(states, list) or not states:
        raise ValueError("A daily schedule must contain at least one state")
    values = [(number(s["hours"], "hours"), state_power(s)) for s in states]
    if sum(h for h, _ in values) > 24 + 1e-9:
        raise ValueError("Mutually exclusive daily states cannot exceed 24 hours")
    return values


def daily_energy(states):
    return sum(hours * watts / 1000 for hours, watts in schedule(states))


def reduction(before, after, rate):
    difference = before - after
    return {
        "baseline_kwh": round(before, 6),
        "proposed_kwh": round(after, 6),
        "energy_reduction_kwh": round(difference, 6),
        "reduction_percent": round(100 * difference / before, 2) if before else None,
        "modeled_variable_cost_reduction_brl": round(difference * rate, 2),
    }


def estimate_household(config):
    rate = number(config["variable_rate_brl_per_kwh"], "variable rate")
    days = number(config["projection_days"], "projection days", positive=True)
    appliances = config["appliances"]
    if not isinstance(appliances, list) or not appliances:
        raise ValueError("Enter at least one appliance")
    rows = []
    total_before = total_after = 0.0
    for appliance in appliances:
        before = daily_energy(appliance["baseline"]) * days
        after = daily_energy(appliance["proposed"]) * days
        rows.append({"appliance": appliance["name"], **reduction(before, after, rate)})
        total_before += before
        total_after += after
    return {
        "evidence": "manual_estimate",
        "period_days": days,
        "variable_rate_brl_per_kwh": rate,
        "appliances": rows,
        "total": reduction(total_before, total_after, rate),
        "interpretation": "Projection from entered assumptions; real-world savings are not verified.",
    }


def simulate_intervals(states):
    """Use 15-minute or shorter intervals, preserving fractional state lengths."""
    values = schedule(states)
    unused = 24 - sum(hours for hours, _ in values)
    if unused > 1e-9:
        values.append((unused, 0))
    rows = []
    minute = 0.0
    for hours, watts in values:
        end = minute + hours * 60
        while minute < end - 1e-9:
            next_minute = min(minute + 15, end)
            rows.append({"start_minute": minute, "end_minute": next_minute,
                         "average_watts": watts, "source": "simulated"})
            minute = next_minute
    return rows


def integrate_simulated_day(rows):
    if not rows:
        raise ValueError("No interval data")
    position = energy = 0.0
    for row in rows:
        if row["source"] != "simulated":
            raise ValueError("This demo accepts only simulated intervals")
        start = number(row["start_minute"], "interval start")
        end = number(row["end_minute"], "interval end")
        watts = number(row["average_watts"], "interval power")
        if not math.isclose(start, position, abs_tol=1e-8, rel_tol=0) or end <= start:
            raise ValueError("Intervals must be ordered, contiguous, and non-overlapping")
        if end > 1440 + 1e-8:
            raise ValueError("Interval exceeds the comparison day")
        energy += watts * (end - start) / 60 / 1000
        position = end
    if not math.isclose(position, 1440, abs_tol=1e-8, rel_tol=0):
        raise ValueError("A comparison needs a complete 24-hour window")
    return energy


def simulated_comparison(config):
    estimate_household(config)  # Validate the same configuration as manual entry.
    rate = config["variable_rate_brl_per_kwh"]
    rows = []
    for appliance in config["appliances"]:
        baseline = simulate_intervals(appliance["baseline"])
        proposed = simulate_intervals(appliance["proposed"])
        rows.append({
            "appliance": appliance["name"],
            "baseline_interval_count": len(baseline),
            "proposed_interval_count": len(proposed),
            **reduction(integrate_simulated_day(baseline), integrate_simulated_day(proposed), rate),
        })
    return {"evidence": "simulated", "comparison_hours_per_window": 24,
            "appliances": rows,
            "interpretation": "Generated from manual assumptions; not an independent experiment or measured savings."}
