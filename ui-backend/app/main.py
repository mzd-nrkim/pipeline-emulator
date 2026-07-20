from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import stages, runs, sse, config as config_router, nodes, documents as documents_router, executions as executions_router, search as search_router
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

@app.get("/health")
def health():
    return {"status": "ok"}

