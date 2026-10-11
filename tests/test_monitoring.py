import pytest
from backend.monitoring import TelemetryStore

def test_telemetry_recording():
    store = TelemetryStore()
    store.record_request("payment-service", "/charge", 200, 45.0)

    summary = store.get_metrics_summary()
    assert summary["total_requests"] == 1
    assert summary["error_count"] == 0
    assert summary["avg_latency_ms"] == 45.0

def test_latency_threshold_incident():
    store = TelemetryStore(latency_threshold_ms=200.0)
    store.record_request("inventory-service", "/query", 200, 250.0)

    incidents = store.get_incidents()
    assert len(incidents) == 1
    assert "Latency" in incidents[0].reason
    assert incidents[0].metric_value == 250.0

def test_error_threshold_incident():
    store = TelemetryStore(error_threshold_count=2)
    store.record_request("auth-service", "/token", 503, 10.0)
    assert len(store.get_incidents()) == 0

    store.record_request("auth-service", "/token", 503, 12.0)
    incidents = store.get_incidents()
    assert len(incidents) == 1
    assert "Downstream error cascade" in incidents[0].reason
