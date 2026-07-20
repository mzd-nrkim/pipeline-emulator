import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import stages, runs, sse, config as config_router, nodes, documents as documents_router, executions as executions_router, search as search_router, health
import uvicorn

app = FastAPI(title="Pipeline Emulator UI Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(stages.router, prefix="/stages", tags=["stages"])
app.include_router(runs.router, prefix="/runs", tags=["runs"])
app.include_router(sse.router, prefix="/sse", tags=["sse"])
app.include_router(config_router.router, prefix="/config", tags=["config"])
app.include_router(nodes.router, prefix="/nodes", tags=["nodes"])
app.include_router(documents_router.router, prefix="/documents", tags=["documents"])
app.include_router(executions_router.router, prefix="/executions", tags=["executions"])
app.include_router(search_router.router, prefix="/search", tags=["search"])
app.include_router(health.router, prefix="/health", tags=["health"])

# B-3: ENABLE_SERVICE_CONTROL flag 게이팅 — off(기본값) 시 라우터 미등록
_svc_ctrl = os.environ.get("ENABLE_SERVICE_CONTROL", "0").strip().lower()
if _svc_ctrl not in ("", "0", "false", "no", "off"):
    from app.api import services as services_router
    app.include_router(services_router.router, prefix="/services", tags=["services"])

@app.get("/health")
def health():
    return {"status": "ok"}

