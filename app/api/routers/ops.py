"""审计、总览与导出接口。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.api.deps import UserIdDep
from app.api.schemas.ops import AuditEvent, AuditListResponse, DashboardOverview, ExportRecord, ExportRequest
from app.db.session import get_session_factory
from app.services.audit import list_events
from app.services.dashboard import build_overview
from app.services.export import ExportError, export_file, export_tasks, list_exports
from app.services.store import as_utc

router = APIRouter(tags=["operations"])


def _event(row) -> AuditEvent:
    return AuditEvent(
        id=row.id,
        task_id=row.task_id,
        event_type=row.event_type,
        message=row.message,
        details=row.details,
        actor=row.actor,
        created_at=as_utc(row.created_at) or row.created_at,
    )


@router.get("/audit-logs", response_model=AuditListResponse)
def get_audit_logs(
    task_id: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> AuditListResponse:
    rows, total = list_events(
        get_session_factory(),
        task_id=task_id,
        event_type=event_type,
        actor=actor,
        search=search,
        limit=limit,
        offset=offset,
    )
    return AuditListResponse(items=[_event(row) for row in rows], total=total)


@router.get("/dashboard/overview", response_model=DashboardOverview)
def get_overview() -> DashboardOverview:
    return build_overview(get_session_factory())


@router.post("/export/csv", response_model=ExportRecord)
def export_csv(body: ExportRequest, user_id: UserIdDep) -> ExportRecord:
    return _export(body.task_ids, "csv", user_id)


@router.post("/export/json", response_model=ExportRecord)
def export_json(body: ExportRequest, user_id: UserIdDep) -> ExportRecord:
    return _export(body.task_ids, "json", user_id)


@router.get("/export-logs", response_model=list[ExportRecord])
def get_export_logs() -> list[ExportRecord]:
    return list_exports(get_session_factory())


@router.get("/export/download/{export_id}")
def download_export(export_id: str) -> FileResponse:
    try:
        path, filename = export_file(get_session_factory(), export_id)
    except ExportError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    media = "text/csv" if path.suffix == ".csv" else "application/json"
    return FileResponse(path, filename=filename, media_type=media)


def _export(task_ids: list[str], export_type: str, actor: str) -> ExportRecord:
    try:
        return export_tasks(get_session_factory(), task_ids, export_type, actor=actor)
    except ExportError as exc:
        status = 404 if "不存在" in exc.message else 409
        raise HTTPException(status_code=status, detail=exc.message) from exc
