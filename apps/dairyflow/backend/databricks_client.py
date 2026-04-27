"""Databricks SQL warehouse client for Databricks Apps.

Auth strategy (in priority order):
  1. DATABRICKS_TOKEN set in env (app.yaml explicit PAT) → use it directly.
     M2M env vars are removed immediately so the SDK sees only one auth method.
  2. DATABRICKS_CLIENT_ID + DATABRICKS_CLIENT_SECRET injected by Databricks Apps
     → use M2M OAuth directly (SP must have warehouse + UC SELECT access).
  3. Neither → local ~/.databrickscfg DEFAULT profile (local dev).
"""
from __future__ import annotations

import logging
import os
from typing import Any

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState

log = logging.getLogger(__name__)

WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "50e0bc7f9918a201")
CATALOG      = os.environ.get("DATABRICKS_CATALOG",          "danonedemo_catalog")
SCHEMA       = os.environ.get("DATABRICKS_SCHEMA",           "digital_twin")
HOST         = os.environ.get("DATABRICKS_HOST",             "https://fevm-danonedemo.cloud.databricks.com")

# If a PAT is explicitly provided, strip M2M vars NOW (at import time) so the
# SDK never sees two auth methods simultaneously.
_DIRECT_TOKEN = os.environ.get("DATABRICKS_TOKEN")
if _DIRECT_TOKEN:
    os.environ.pop("DATABRICKS_CLIENT_ID", None)
    os.environ.pop("DATABRICKS_CLIENT_SECRET", None)
    log.info("Auth mode: PAT (DATABRICKS_TOKEN) — M2M env vars cleared")

_client: WorkspaceClient | None = None


def get_client() -> WorkspaceClient:
    global _client
    if _client is None:
        client_id     = os.environ.get("DATABRICKS_CLIENT_ID")
        client_secret = os.environ.get("DATABRICKS_CLIENT_SECRET")

        if _DIRECT_TOKEN:
            log.info("Auth: explicit PAT via DATABRICKS_TOKEN")
            _client = WorkspaceClient(host=HOST, token=_DIRECT_TOKEN)

        elif client_id and client_secret:
            log.info("Auth: M2M OAuth (Databricks Apps service principal)")
            _client = WorkspaceClient(
                host=HOST,
                client_id=client_id,
                client_secret=client_secret,
            )

        else:
            log.info("Auth: ~/.databrickscfg profile (local dev)")
            _client = WorkspaceClient(
                profile=os.environ.get("DATABRICKS_PROFILE", "DEFAULT")
            )

        log.info("Client ready | host=%s | warehouse=%s | catalog=%s.%s",
                 HOST, WAREHOUSE_ID, CATALOG, SCHEMA)
    return _client


def execute_sql(sql: str, timeout: int = 50) -> list[dict[str, Any]]:
    """Execute SQL on the configured warehouse. Returns rows as list of dicts."""
    client = get_client()

    response = client.statement_execution.execute_statement(
        warehouse_id=WAREHOUSE_ID,
        statement=sql,
        catalog=CATALOG,
        schema=SCHEMA,
        wait_timeout=f"{min(timeout, 50)}s",
    )

    state: StatementState = response.status.state

    if state in (StatementState.PENDING, StatementState.RUNNING):
        raise RuntimeError(
            f"SQL timed out after {timeout}s (state={state}). "
            "Warehouse may still be starting — retry shortly."
        )

    if state != StatementState.SUCCEEDED:
        error = getattr(response.status, "error", None)
        raise RuntimeError(f"SQL failed (state={state}): {error}")

    result = response.result
    if not result or not result.data_array:
        return []

    manifest = response.manifest
    if not manifest or not manifest.schema or not manifest.schema.columns:
        raise RuntimeError("SQL succeeded but response manifest/schema is missing.")

    columns = [(col.name, col.type_name) for col in manifest.schema.columns]
    return [_coerce_row(columns, row) for row in result.data_array]


def _coerce_row(
    columns: list[tuple[str, Any]], row: list[str | None]
) -> dict[str, Any]:
    """Convert Databricks string values to Python native types using manifest types.

    type_name is a ColumnInfoTypeName enum — use .value to get the string, e.g. 'DOUBLE'.
    """
    out: dict[str, Any] = {}
    for (name, type_name), val in zip(columns, row):
        if val is None:
            out[name] = None
            continue
        # .value on the enum gives the canonical string ("DOUBLE", "INT", …)
        t = (type_name.value if hasattr(type_name, "value") else str(type_name)).upper()
        try:
            if t in ("INT", "INTEGER", "LONG", "SHORT", "BYTE", "BIGINT", "SMALLINT", "TINYINT"):
                out[name] = int(val)
            elif t in ("FLOAT", "DOUBLE", "DECIMAL", "REAL"):
                out[name] = float(val)
            elif t == "BOOLEAN":
                out[name] = val.lower() in ("true", "1")
            else:
                out[name] = val
        except (ValueError, AttributeError):
            out[name] = val
    return out
