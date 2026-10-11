import time
from typing import List, Dict
from pydantic import BaseModel

class TelemetryRecord(BaseModel):
    service_name: str
    endpoint: str
    status_code: int
    duration_ms: float
    timestamp: float

class Incident(BaseModel):
    incident_id: str
    service_name: str
    reason: str
    metric_value: float
    threshold: float
    timestamp: float

class TelemetryStore:
    def __init__(self, latency_threshold_ms: float = 300.0, error_threshold_count: int = 3):
        self.records: List[TelemetryRecord] = []
        self.incidents: List[Incident] = []
        self.latency_threshold_ms = latency_threshold_ms
        self.error_threshold_count = error_threshold_count
        self._consecutive_errors: Dict[str, int] = {}

    def record_request(self, service: str, endpoint: str, status_code: int, duration_ms: float):
        now = time.time()
        record = TelemetryRecord(
            service_name=service,
            endpoint=endpoint,
            status_code=status_code,
            duration_ms=duration_ms,
            timestamp=now
        )
        self.records.append(record)
        self._evaluate_anomalies(record)

    def _evaluate_anomalies(self, record: TelemetryRecord):
        # Latency threshold check
        if record.duration_ms > self.latency_threshold_ms:
            self.incidents.append(
                Incident(
                    incident_id=f"INC-LAT-{len(self.incidents) + 1}",
                    service_name=record.service_name,
                    reason="Latency threshold exceeded",
                    metric_value=round(record.duration_ms, 2),
                    threshold=self.latency_threshold_ms,
                    timestamp=record.timestamp
                )
            )

        # Consecutive downstream error check
        if record.status_code >= 500:
            count = self._consecutive_errors.get(record.service_name, 0) + 1
            self._consecutive_errors[record.service_name] = count
            if count >= self.error_threshold_count:
                self.incidents.append(
                    Incident(
                        incident_id=f"INC-ERR-{len(self.incidents) + 1}",
                        service_name=record.service_name,
                        reason="Downstream error cascade detected",
                        metric_value=float(count),
                        threshold=float(self.error_threshold_count),
                        timestamp=record.timestamp
                    )
                )
                self._consecutive_errors[record.service_name] = 0
        else:
            self._consecutive_errors[record.service_name] = 0

    def get_metrics_summary(self) -> dict:
        total = len(self.records)
        if total == 0:
            return {"total_requests": 0, "avg_latency_ms": 0.0, "error_count": 0, "error_rate": 0.0}

        errors = sum(1 for r in self.records if r.status_code >= 400)
        avg_latency = sum(r.duration_ms for r in self.records) / total

        return {
            "total_requests": total,
            "avg_latency_ms": round(avg_latency, 2),
            "error_count": errors,
            "error_rate": round((errors / total) * 100, 2),
            "recent_records": [r.model_dump() for r in self.records[-10:]]
        }

    def get_incidents(self) -> List[Incident]:
        return self.incidents

    def clear(self):
        self.records.clear()
        self.incidents.clear()
        self._consecutive_errors.clear()
