import asyncio
import pytest
from backend.circuit_breaker import CircuitBreaker, CircuitState

@pytest.mark.asyncio
async def test_circuit_trips_to_open_on_threshold():
    cb = CircuitBreaker(failure_threshold=2, recovery_cooldown_seconds=1.0)

    async def fail_task():
        raise RuntimeError("Service failure")

    with pytest.raises(RuntimeError):
        await cb.call(fail_task)
    assert cb.state == CircuitState.CLOSED

    with pytest.raises(RuntimeError):
        await cb.call(fail_task)
    assert cb.state == CircuitState.OPEN

@pytest.mark.asyncio
async def test_circuit_fast_fails_with_fallback():
    cb = CircuitBreaker(failure_threshold=1, recovery_cooldown_seconds=1.0)

    async def fail_task():
        raise RuntimeError("Fail")

    async def fallback_task():
        return "fallback_result"

    with pytest.raises(RuntimeError):
        await cb.call(fail_task)
    assert cb.state == CircuitState.OPEN

    result = await cb.call(fail_task, fallback=fallback_task)
    assert result == "fallback_result"

@pytest.mark.asyncio
async def test_circuit_recovery_half_open_to_closed():
    cb = CircuitBreaker(failure_threshold=1, recovery_cooldown_seconds=0.2)

    async def fail_task():
        raise RuntimeError("Fail")

    async def success_task():
        return "healthy_result"

    with pytest.raises(RuntimeError):
        await cb.call(fail_task)
    assert cb.state == CircuitState.OPEN

    await asyncio.sleep(0.25)

    result = await cb.call(success_task)
    assert result == "healthy_result"
    assert cb.state == CircuitState.CLOSED
