"""SP-API Business Report routes.

Endpoints:
  POST /api/v1/sp/fetch          — trigger SP-API report fetch
  GET  /api/v1/sp/summary        — aggregated business summary
  GET  /api/v1/sp/products       — product master list
  GET  /api/v1/sp/products/{asin}/daily — daily metrics for one ASIN
  GET  /api/v1/sp/profitability  — unified organic + paid view
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, ProductAdsDaily
from app.models.sp_business import ProductBusinessDaily, ProductsMaster
from app.utils.queue_health import require_broker
from app.schemas.sp_business import (
    BusinessMetricsDaily, BusinessSummary, ProductSummary,
    ProductProfitabilityRow, SpFetchRequest,
)

router = APIRouter(prefix="/api/v1/sp", tags=["sp-business"])


def _resolve_client(current_user: User, client_id: Optional[int]) -> int:
    if current_user.role == "Admin" and client_id:
        return client_id
    return current_user.client_id


# ── Fetch trigger ────────────────────────────────────────────────────────────

@router.post("/fetch", status_code=status.HTTP_202_ACCEPTED)
def trigger_sp_fetch(
    body: SpFetchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue an SP-API business report fetch for the current client."""
    if current_user.role not in ("Admin", "Seller"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    client_id = _resolve_client(current_user, None)
    if not client_id:
        raise HTTPException(status_code=400, detail="No client associated")
    require_broker()

    try:
        from app.tasks.fetch_sp_reports import fetch_sp_business_report
        task = fetch_sp_business_report.delay(
            client_id=client_id,
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
    return {"task_id": task.id, "message": "SP-API fetch queued"}


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=BusinessSummary)
def business_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    marketplace_id: Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    if not cid:
        raise HTTPException(status_code=400, detail="No client")

    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today - timedelta(days=30)
    ed = date.fromisoformat(end_date) if end_date else today

    q = db.query(
        func.count(func.distinct(ProductBusinessDaily.asin)).label("asin_count"),
        func.coalesce(func.sum(ProductBusinessDaily.sessions_total), 0).label("total_sessions"),
        func.coalesce(func.sum(ProductBusinessDaily.page_views_total), 0).label("total_page_views"),
        func.coalesce(func.sum(ProductBusinessDaily.units_ordered), 0).label("total_units_ordered"),
        func.coalesce(func.sum(ProductBusinessDaily.ordered_product_sales), 0).label("total_ordered_sales"),
        func.coalesce(func.sum(ProductBusinessDaily.units_refunded), 0).label("total_units_refunded"),
        func.avg(ProductBusinessDaily.unit_session_pct).label("avg_conversion_rate"),
        func.avg(ProductBusinessDaily.featured_offer_pct).label("avg_buy_box_pct"),
    ).filter(
        ProductBusinessDaily.client_id == cid,
        ProductBusinessDaily.report_date >= sd,
        ProductBusinessDaily.report_date <= ed,
    )
    if marketplace_id:
        q = q.filter(ProductBusinessDaily.marketplace_id == marketplace_id)

    row = q.first()
    return BusinessSummary(
        start_date=sd, end_date=ed,
        asin_count=row.asin_count or 0,
        total_sessions=row.total_sessions or 0,
        total_page_views=row.total_page_views or 0,
        total_units_ordered=row.total_units_ordered or 0,
        total_ordered_sales=float(row.total_ordered_sales or 0),
        total_units_refunded=row.total_units_refunded or 0,
        avg_conversion_rate=float(row.avg_conversion_rate) if row.avg_conversion_rate else None,
        avg_buy_box_pct=float(row.avg_buy_box_pct) if row.avg_buy_box_pct else None,
    )


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[ProductSummary])
def list_products(
    page: int = 1,
    per_page: int = 50,
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    offset = (page - 1) * per_page
    return (
        db.query(ProductsMaster)
        .filter(ProductsMaster.client_id == cid)
        .order_by(ProductsMaster.last_seen.desc())
        .offset(offset).limit(per_page).all()
    )


@router.get("/products/{asin}/daily", response_model=list[BusinessMetricsDaily])
def product_daily_metrics(
    asin: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = _resolve_client(current_user, client_id)
    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today - timedelta(days=30)
    ed = date.fromisoformat(end_date) if end_date else today

    rows = (
        db.query(ProductBusinessDaily)
        .filter(
            ProductBusinessDaily.client_id == cid,
            ProductBusinessDaily.asin == asin,
            ProductBusinessDaily.report_date >= sd,
            ProductBusinessDaily.report_date <= ed,
        )
        .order_by(ProductBusinessDaily.report_date)
        .all()
    )
    return rows


# ── Product Profitability (unified organic + paid) ────────────────────────────

@router.get("/profitability", response_model=list[ProductProfitabilityRow])
def product_profitability(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = 50,
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Combine SP-API organic data with Ads API paid data per ASIN."""
    cid = _resolve_client(current_user, client_id)
    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today - timedelta(days=30)
    ed = date.fromisoformat(end_date) if end_date else today

    # Organic data (SP-API)
    organic_rows = db.query(
        ProductBusinessDaily.asin,
        func.max(ProductBusinessDaily.title).label("title"),
        func.sum(ProductBusinessDaily.sessions_total).label("sessions"),
        func.sum(ProductBusinessDaily.page_views_total).label("page_views"),
        func.sum(ProductBusinessDaily.units_ordered).label("units_ordered"),
        func.sum(ProductBusinessDaily.ordered_product_sales).label("organic_sales"),
        func.avg(ProductBusinessDaily.unit_session_pct).label("conversion_rate"),
        func.avg(ProductBusinessDaily.refund_rate).label("refund_rate"),
    ).filter(
        ProductBusinessDaily.client_id == cid,
        ProductBusinessDaily.report_date >= sd,
        ProductBusinessDaily.report_date <= ed,
    ).group_by(ProductBusinessDaily.asin).all()

    organic_map = {r.asin: r for r in organic_rows}

    # Paid data (Ads API — product_ads_daily for ASIN-level ad data)
    paid_rows = db.query(
        ProductAdsDaily.asin,
        func.sum(ProductAdsDaily.spend).label("ad_spend"),
        func.sum(ProductAdsDaily.sales).label("ad_sales"),
        func.sum(ProductAdsDaily.orders).label("ad_orders"),
    ).filter(
        ProductAdsDaily.client_id == cid,
        ProductAdsDaily.date >= sd,
        ProductAdsDaily.date <= ed,
        ProductAdsDaily.asin.isnot(None),
    ).group_by(ProductAdsDaily.asin).all()

    paid_map = {r.asin: r for r in paid_rows}

    # Merge
    all_asins = set(organic_map.keys()) | set(paid_map.keys())
    results = []
    for asin in list(all_asins)[:limit]:
        org = organic_map.get(asin)
        paid = paid_map.get(asin)

        ad_spend = float(paid.ad_spend or 0) if paid else None
        ad_sales = float(paid.ad_sales or 0) if paid else None
        ad_orders = int(paid.ad_orders or 0) if paid else None
        organic_sales = float(org.organic_sales or 0) if org else None
        organic_units = int(org.units_ordered or 0) if org else None

        acos = (ad_spend / ad_sales * 100) if (ad_spend and ad_sales and ad_sales > 0) else None
        roas = (ad_sales / ad_spend) if (ad_sales and ad_spend and ad_spend > 0) else None

        total_sales = (organic_sales or 0) + (ad_sales or 0) if (organic_sales is not None or ad_sales is not None) else None

        results.append(ProductProfitabilityRow(
            asin=asin,
            title=org.title if org else None,
            organic_sessions=int(org.sessions or 0) if org else None,
            organic_page_views=int(org.page_views or 0) if org else None,
            organic_units_ordered=organic_units,
            organic_sales=organic_sales,
            conversion_rate=float(org.conversion_rate) if (org and org.conversion_rate) else None,
            refund_rate=float(org.refund_rate) if (org and org.refund_rate) else None,
            ad_spend=ad_spend,
            ad_sales=ad_sales,
            ad_orders=ad_orders,
            acos=acos,
            roas=roas,
            total_sales=total_sales,
            total_orders=(organic_units or 0) + (ad_orders or 0) if (organic_units is not None or ad_orders is not None) else None,
        ))

    # Sort by total_sales desc
    results.sort(key=lambda r: r.total_sales or 0, reverse=True)
    return results
