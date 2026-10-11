import time
from enum import Enum
from typing import Callable, Any, Optional

class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

class CircuitBreakerOpenException(Exception):
    pass

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_cooldown_seconds: float = 5.0,
        name: str = "default_breaker"
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_cooldown_seconds = recovery_cooldown_seconds

        self.state: CircuitState = CircuitState.CLOSED
        self.failure_count: int = 0
        self.last_failure_time: Optional[float] = None
        self.opened_at: Optional[float] = None

    def _check_state(self):
        now = time.time()
        if self.state == CircuitState.OPEN:
            if self.opened_at and (now - self.opened_at >= self.recovery_cooldown_seconds):
                self.state = CircuitState.HALF_OPEN

    async def call(self, func: Callable, *args, fallback: Optional[Callable] = None, **kwargs) -> Any:
        self._check_state()

        if self.state == CircuitState.OPEN:
            if fallback:
                return await fallback(*args, **kwargs) if callable(fallback) else fallback
            raise CircuitBreakerOpenException(f"Circuit '{self.name}' is OPEN. Fast-failing request.")

        try:
            result = await func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            if fallback:
                return await fallback(*args, **kwargs) if callable(fallback) else fallback
            raise e

    def on_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.opened_at = None
        elif self.state == CircuitState.CLOSED:
            self.failure_count = 0

    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            self.opened_at = time.time()
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.opened_at = time.time()

    def get_status(self) -> dict:
        self._check_state()
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "threshold": self.failure_threshold,
            "cooldown_seconds": self.recovery_cooldown_seconds,
            "opened_at": self.opened_at
        }
