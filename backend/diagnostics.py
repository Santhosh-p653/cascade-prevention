from typing import Dict, Any
from backend.monitoring import Incident

class DiagnosticEngine:
    """Prepares structured incident context for AI analysis and rapid operational mitigation."""

    @staticmethod
    def diagnose(incident: Incident, recent_metrics: Dict[str, Any]) -> Dict[str, Any]:
        error_rate = recent_metrics.get("error_rate", 0)

        if "Latency" in incident.reason:
            summary = (
                f"Downstream service '{incident.service_name}' latency reached {incident.metric_value}ms "
                f"(threshold: {incident.threshold}ms). Anomaly points to potential thread pool starvation or IO stall."
            )
            mitigation = "Activate circuit breaker to shed load and throttle upstream retries."
        else:
            summary = (
                f"Repeated 5xx failures detected on '{incident.service_name}'. "
                f"Recent error rate at {error_rate}%."
            )
            mitigation = "Reroute incoming requests to cached read-only fallback and begin canary health probes."

        return {
            "incident_id": incident.incident_id,
            "service": incident.service_name,
            "detected_at": incident.timestamp,
            "root_cause_hypothesis": summary,
            "suggested_mitigation": mitigation,
            "prompt_payload": {
                "system_role": "Site Reliability Engineer",
                "incident_context": incident.model_dump(),
                "telemetry_context": recent_metrics
            }
        }
