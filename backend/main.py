import time
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.monitoring import TelemetryStore
from backend.circuit_breaker import CircuitBreaker, CircuitBreakerOpenException
from backend.simulator import ServiceSimulator
from backend.diagnostics import DiagnosticEngine

app = FastAPI(
    title="AI-Assisted DevOps Timeout Cascade Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

telemetry = TelemetryStore(latency_threshold_ms=300.0, error_threshold_count=3)
breaker = CircuitBreaker(failure_threshold=3, recovery_cooldown_seconds=3.0, name="order-service-breaker")

async def fallback_response(*args, **kwargs):
    return {
        "status": "degraded",
        "data": "Cached response (Circuit Breaker active)",
        "circuit_open": True
    }

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": time.time()}

@app.post("/simulate")
async def run_simulation(mode: str = Query("healthy", pattern="^(healthy|slow|timeout|error)$")):
    start = time.time()
    status_code = 200
    response_data = None

    try:
        response_data = await breaker.call(
            ServiceSimulator.mock_call,
            mode=mode,
            fallback=fallback_response
        )
        if isinstance(response_data, dict) and response_data.get("circuit_open"):
            status_code = 503
    except CircuitBreakerOpenException:
        status_code = 503
        response_data = await fallback_response()
    except (TimeoutError, HTTPException) as e:
        status_code = 504 if isinstance(e, TimeoutError) else e.status_code
        response_data = {"status": "error", "message": str(e)}
    except Exception as e:
        status_code = 500
        response_data = {"status": "error", "message": str(e)}
    finally:
        duration_ms = (time.time() - start) * 1000.0
        telemetry.record_request(
            service="order-service",
            endpoint="/simulate",
            status_code=status_code,
            duration_ms=duration_ms
        )

    return {
        "duration_ms": round(duration_ms, 2),
        "status_code": status_code,
        "circuit_state": breaker.state.value,
        "data": response_data
    }

@app.get("/metrics")
def get_metrics():
    return telemetry.get_metrics_summary()

@app.get("/incidents")
def get_incidents():
    return telemetry.get_incidents()

@app.get("/circuit-breaker")
def get_circuit_state():
    return breaker.get_status()

@app.post("/diagnostics/{incident_id}")
def generate_diagnosis(incident_id: str):
    incidents = [inc for inc in telemetry.get_incidents() if inc.incident_id == incident_id]
    if not incidents:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    return DiagnosticEngine.diagnose(incidents[0], telemetry.get_metrics_summary())
