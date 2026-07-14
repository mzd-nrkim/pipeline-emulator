import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.mysql_aggregator import get_stage_counts

router = APIRouter()

async def event_generator():
    while True:
        counts = get_stage_counts()
        data = json.dumps({"type": "stage_update", "counts": counts})
        yield f"data: {data}\n\n"
        await asyncio.sleep(5)

@router.get("/stages")
async def sse_stages():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
