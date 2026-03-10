"""Danone DairyFlow — FastAPI backend for Databricks Apps.

Serves the REST/SSE API (/api/*) and the pre-built React SPA from static/.
"""
import logging
import os
import traceback
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from routers import batches, equipment, graph, simulate, stream, sustainability

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(
    title="Danone DairyFlow API",
    description="Bio-Mechanical Optimizer — Decision Intelligence Hub",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler — turns unhandled exceptions into JSON 500s ───────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    log.error("Unhandled exception on %s: %s\n%s", request.url.path, exc, tb)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": tb},
    )


# ── API routes (must be registered BEFORE the SPA catch-all) ──────────────────
app.include_router(stream.router, prefix="/api")
app.include_router(equipment.router, prefix="/api")
app.include_router(batches.router, prefix="/api")
app.include_router(sustainability.router, prefix="/api")
app.include_router(graph.router, prefix="/api")
app.include_router(simulate.router, prefix="/api")


@app.get("/api/health")
async def health():
    import databricks_client as dc
    return {
        "status": "ok",
        "warehouse_id": dc.WAREHOUSE_ID,
        "catalog": dc.CATALOG,
        "schema": dc.SCHEMA,
        "databricks_host": os.environ.get("DATABRICKS_HOST", "not set"),
        "has_client_id": bool(os.environ.get("DATABRICKS_CLIENT_ID")),
        "has_client_secret": bool(os.environ.get("DATABRICKS_CLIENT_SECRET")),
    }


@app.get("/api/debug/sql-ping")
async def sql_ping():
    """Quick connectivity check — runs a trivial SQL statement."""
    try:
        import databricks_client as dc
        rows = dc.execute_sql("SELECT 1 AS ping, current_timestamp() AS ts", timeout=30)
        return {"status": "ok", "result": rows}
    except Exception as exc:
        tb = traceback.format_exc()
        return JSONResponse(status_code=500, content={"error": str(exc), "traceback": tb})


@app.get("/api/debug/auth")
async def debug_auth():
    """Show which auth path was taken and env var presence."""
    return {
        "has_token": bool(os.environ.get("DATABRICKS_TOKEN")),
        "has_client_id": bool(os.environ.get("DATABRICKS_CLIENT_ID")),
        "has_client_secret": bool(os.environ.get("DATABRICKS_CLIENT_SECRET")),
        "host": os.environ.get("DATABRICKS_HOST", "not set"),
        "secret_scope": os.environ.get("SECRET_SCOPE", "not set"),
        "secret_key": os.environ.get("SECRET_KEY", "not set"),
        "warehouse_id": os.environ.get("DATABRICKS_WAREHOUSE_ID", "not set"),
    }


# ── Static React frontend ──────────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
        log.info("Mounted /assets → %s", assets_dir)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """SPA catch-all — let React Router handle client-side navigation."""
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse(
            status_code=503,
            content={"error": "Frontend not built. Run: npm run build"},
        )
else:
    log.warning("static/ directory not found — frontend will not be served.")

    @app.get("/")
    async def root():
        return {"message": "DairyFlow API is running. Frontend static/ not found."}
