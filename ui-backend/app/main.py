from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import stages, runs, sse, config as config_router
import uvicorn

app = FastAPI(title="Pipeline Emulator UI Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(stages.router, prefix="/stages", tags=["stages"])
app.include_router(runs.router, prefix="/runs", tags=["runs"])
app.include_router(sse.router, prefix="/sse", tags=["sse"])
app.include_router(config_router.router, prefix="/config", tags=["config"])

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/stages")  # 최상위 alias (pipeline 페이지 호환)
def get_stages_alias():
    from app.api.stages import get_stages
    return get_stages()
