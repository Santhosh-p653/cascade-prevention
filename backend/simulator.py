import asyncio
from fastapi import HTTPException

class ServiceSimulator:
    """Simulates healthy, slow, and failing downstream dependencies."""

    @staticmethod
    async def mock_call(mode: str) -> dict:
        if mode == "healthy":
            await asyncio.sleep(0.02)
            return {"status": "success", "data": "Order processed"}

        elif mode == "slow":
            # Exceeds the 300ms latency threshold
            await asyncio.sleep(0.45)
            return {"status": "success", "data": "Order processed slowly"}

        elif mode == "timeout":
            # Triggers timeout exception
            await asyncio.sleep(0.60)
            raise TimeoutError("Downstream dependency timed out after 600ms")

        elif mode == "error":
            await asyncio.sleep(0.01)
            raise HTTPException(status_code=503, detail="Downstream service unavailable")

        else:
            raise ValueError(f"Unknown simulation mode: {mode}")
