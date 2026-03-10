"""Databricks SQL warehouse client for Databricks Apps.

Auth strategy on Databricks Apps:
  1. Runtime injects DATABRICKS_CLIENT_ID + DATABRICKS_CLIENT_SECRET (M2M OAuth).
  2. We use those to fetch the PAT from Databricks Secrets.
  3. We re-init with PAT, but must temporarily unset the M2M env vars first —
     otherwise the SDK raises "more than one authorization method configured".

Locally:
  Falls back to ~/.databrickscfg DEFAULT profile.
"""
from __future__ import annotations

import base64
import logging
import os
from contextlib import contextmanager
from typing import Any

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState

log = logging.getLogger(__name__)

WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "50e0bc7f9918a201")
CATALOG = os.environ.get("DATABRICKS_CATALOG", "danonedemo_catalog")
SCHEMA = os.environ.get("DATABRICKS_SCHEMA", "digital_twin")
HOST = os.environ.get("DATABRICKS_HOST", "https://fevm-danonedemo.cloud.databricks.com")

_client: WorkspaceClient | None = None

# Keys that conflict with PAT auth when present in the environment
_M2M_ENV_KEYS = ("DATABRICKS_CLIENT_ID", "DATABRICKS_CLIENT_SECRET")


@contextmanager
def _without_m2m_env():
    """Temporarily remove M2M OAuth env vars so the SDK accepts PAT auth."""
    saved = {k: os.environ.pop(k) for k in _M2M_ENV_KEYS if k in os.environ}
    try:
        yield
    finally:
        os.environ.update(saved)


def _fetch_pat_from_secret(w: WorkspaceClient) -> str | None:
    """Use the M2M client to read the PAT from Databricks Secrets."""
    scope = os.environ.get("SECRET_SCOPE")
    key = os.environ.get("SECRET_KEY")
    if not scope or not key:
        return None
    try:
        resp = w.secrets.get_secret(scope=scope, key=key)
        if resp.value:
            return base64.b64decode(resp.value).decode("utf-8").strip()
    except Exception as exc:
        log.warning("Could not fetch secret %s/%s: %s", scope, key, exc)
    return None


def get_client() -> WorkspaceClient:
    global _client
    if _client is None:
        direct_token = os.environ.get("DATABRICKS_TOKEN")
        client_id = os.environ.get("DATABRICKS_CLIENT_ID")
        client_secret = os.environ.get("DATABRICKS_CLIENT_SECRET")

        if direct_token:
            # PAT provided directly — unset M2M vars to avoid conflict
            log.info("Auth: DATABRICKS_TOKEN env var")
            with _without_m2m_env():
                _client = WorkspaceClient(host=HOST, token=direct_token)

        elif client_id and client_secret:
            # Databricks Apps M2M: bootstrap a temporary M2M client to read the secret,
            # then switch to PAT for all subsequent SQL calls.
            log.info("Auth: M2M → fetching PAT from Databricks Secrets")
            m2m = WorkspaceClient(host=HOST, client_id=client_id, client_secret=client_secret)
            pat = _fetch_pat_from_secret(m2m)

            if pat:
                log.info("Auth: PAT retrieved from secret, re-initialising (M2M env vars unset)")
                with _without_m2m_env():
                    _client = WorkspaceClient(host=HOST, token=pat)
            else:
                # Secret unavailable — fall back to M2M for all calls
                log.info("Auth: falling back to M2M OAuth (secret unavailable)")
                _client = m2m

        else:
            # Local development — no env vars → config file
            log.info("Auth: ~/.databrickscfg DEFAULT profile")
            _client = WorkspaceClient(
                profile=os.environ.get("DATABRICKS_PROFILE", "DEFAULT")
            )

        log.info("Client ready | host=%s | auth=%s", HOST,
                 getattr(_client.config, "auth_type", "unknown"))
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
