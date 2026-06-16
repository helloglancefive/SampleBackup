from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User
from app.rate_limit import limiter
from app.schemas.dashboard import (
    MetricsSummary, ChartData, DashboardSummary,
    SearchTermRow, KeywordRow, ProductRow, ProductDailyRow, CampaignRow, PlacementRow,
)
from app.services import dashboard_service

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


def _resolve_client(current_user: User, client_id: Optional[int] = None) -> int:
    if client_id is not None:
        if current_user.role != "Admin" and current_user.client_id != client_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return client_id
    if not current_user.client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client associated with this account")
    return current_user.client_id


def _default_dates() -> tuple[date, date]:
    end = date.today()
    return end - timedelta(days=29), end


@router.get("/metrics", response_model=MetricsSummary)
@limiter.limit("60/minute")
def get_metrics(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    report_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_metrics_summary(db, cid, start_date, end_date, report_type)


@router.get("/charts", response_model=ChartData)
@limiter.limit("60/minute")
def get_charts(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    report_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_chart_data(db, cid, start_date, end_date, report_type)


@router.get("/summary", response_model=DashboardSummary)
@limiter.limit("60/minute")
def get_summary(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    return dashboard_service.get_dashboard_summary(db, cid, start_date, end_date)


@router.get("/search-terms", response_model=list[SearchTermRow])
@limiter.limit("60/minute")
def get_search_terms(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = Query(default="cost", pattern="^(cost|acos|clicks|sales|impressions)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_search_terms(db, cid, start_date, end_date, limit, sort_by)


@router.get("/keywords", response_model=list[KeywordRow])
@limiter.limit("60/minute")
def get_keywords(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = Query(default="cost", pattern="^(cost|acos|clicks|sales|impressions)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_keywords(db, cid, start_date, end_date, limit, sort_by)


@router.get("/campaigns", response_model=list[CampaignRow])
@limiter.limit("60/minute")
def get_campaigns(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    report_type: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_campaigns(db, cid, start_date, end_date, report_type, limit)


@router.get("/products/daily", response_model=list[ProductDailyRow])
@limiter.limit("60/minute")
def get_products_daily(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_products_daily(db, cid, start_date, end_date, limit)


@router.get("/placements", response_model=list[PlacementRow])
@limiter.limit("60/minute")
def get_placements(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    report_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_placements(db, cid, start_date, end_date, report_type)


@router.get("/products", response_model=list[ProductRow])
@limiter.limit("60/minute")
def get_products(
    request: Request,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not start_date or not end_date:
        start_date, end_date = _default_dates()
    return dashboard_service.get_products(db, cid, start_date, end_date, limit)
