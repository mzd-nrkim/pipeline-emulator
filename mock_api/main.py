from fastapi import FastAPI
from routes import chunking, enrichment

app = FastAPI(title="Pipeline Emulator Mock API")

app.include_router(chunking.router)
app.include_router(enrichment.router)


@app.get("/health")
def health():
    return {"status": "ok"}
