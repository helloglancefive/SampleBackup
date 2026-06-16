from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, ReportFetch
from app.rate_limit import limiter
from app.schemas.reports import FetchRequest, FetchResponse, TaskStatusResponse, FetchHistoryItem
from app.utils.queue_health import require_broker

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def _resolve_client(current_user: User, client_id=None) -> int:
    if client_id is not None:
        if current_user.role != "Admin" and current_user.client_id != client_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return client_id
    if not current_user.client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client associated with this account")
    return current_user.client_id


@router.post("/fetch", response_model=FetchResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
def trigger_fetch(
    request: Request,
    body: FetchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Admin", "Seller"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    cid = _resolve_client(current_user, body.client_id)
    require_broker()

    try:
        from app.tasks.fetch_reports import fetch_reports_for_client
        task = fetch_reports_for_client.delay(
            client_id=cid,
            report_types=body.report_types,
            start_date=body.start_date,
            end_date=body.end_date,
            triggered_by="on_demand",
            triggered_by_user_id=current_user.id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Task queue unavailable: {exc}",
        )

    return FetchResponse(
        task_id=task.id,
        client_id=cid,
        report_types=body.report_types,
        start_date=body.start_date,
        end_date=body.end_date,
        message="Fetch task queued successfully",
    )


@router.get("/fetch/{task_id}/status", response_model=TaskStatusResponse)
@limiter.limit("30/minute")
def fetch_task_status(
    request: Request,
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        from celery_app import celery_app
        from celery.result import AsyncResult
        result = AsyncResult(task_id, app=celery_app)
        state = result.state
        task_result = None
        error = None
        if state == "SUCCESS":
            task_result = result.result
        elif state == "FAILURE":
            error = str(result.result)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Cannot reach task queue: {exc}")

    return TaskStatusResponse(task_id=task_id, state=state, result=task_result, error=error)


@router.get("/fetch-history")
@limiter.limit("30/minute")
def fetch_history(
    request: Request,
    client_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    offset = (page - 1) * per_page
    total = db.query(ReportFetch).filter(ReportFetch.client_id == cid).count()
    items = (
        db.query(ReportFetch)
        .filter(ReportFetch.client_id == cid)
        .order_by(ReportFetch.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )
    return {"items": [FetchHistoryItem.model_validate(i) for i in items], "total": total, "page": page, "per_page": per_page}
