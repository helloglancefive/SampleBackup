"""Dashboard aggregation queries against normalized reporting tables."""
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import and_, func, distinct
from sqlalchemy.orm import Session

from app.models.reporting import (
    CampaignDailyMetrics,
    CampaignsMaster,
    SearchTermDaily,
    TargetingDaily,
    ProductAdsDaily,
    PlacementDaily,
)
from app.models.report_fetch import ReportFetch
from app.schemas.dashboard import (
    MetricsSummary, DailyDataPoint, ChartData, AdTypeBreakdown,
    TopCampaign, DashboardSummary, SearchTermRow, KeywordRow, ProductRow,
    ProductDailyRow, CampaignRow, PlacementRow,
)

_SP_CAMPAIGNS = "spCampaigns"
_SB_CAMPAIGNS = "sbCampaigns"
_SD_CAMPAIGNS = "sdCampaigns"
_SP_TARGETING = "spTargeting"


def _safe_float(value, ndigits: int = 4) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return round(f, ndigits) if f else None


def _trend(current: float, previous: float) -> Optional[float]:
    if not previous:
        return None
    return round((current - previous) / previous * 100, 2)


def _run_summary_query(db: Session, client_id: int, start: date, end: date, report_type: Optional[str]):
    q = db.query(
        func.coalesce(func.sum(CampaignDailyMetrics.impressions), 0).label("total_impressions"),
        func.coalesce(func.sum(CampaignDailyMetrics.clicks), 0).label("total_clicks"),
        func.coalesce(func.sum(CampaignDailyMetrics.spend), 0).label("total_cost"),
        func.coalesce(func.sum(CampaignDailyMetrics.sales), 0).label("total_sales"),
        func.coalesce(func.sum(CampaignDailyMetrics.orders), 0).label("total_orders"),
        func.count(CampaignDailyMetrics.id).label("records_count"),
    ).filter(
        CampaignDailyMetrics.client_id == client_id,
        CampaignDailyMetrics.date >= start,
        CampaignDailyMetrics.date <= end,
    )
    if report_type:
        q = q.filter(CampaignDailyMetrics.report_type == report_type)
    return q.first()


def get_metrics_summary(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    report_type: Optional[str] = None,
) -> MetricsSummary:
    row = _run_summary_query(db, client_id, start_date, end_date, report_type)

    total_impressions = int(row.total_impressions or 0)
    total_clicks = int(row.total_clicks or 0)
    total_cost = float(row.total_cost or 0)
    total_sales = float(row.total_sales or 0)
    total_orders = int(row.total_orders or 0)
    records_count = int(row.records_count or 0)

    period_days = (end_date - start_date).days + 1
    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)
    prev = _run_summary_query(db, client_id, prev_start, prev_end, report_type)

    p_impressions = int(prev.total_impressions or 0)
    p_clicks = int(prev.total_clicks or 0)
    p_cost = float(prev.total_cost or 0)
    p_sales = float(prev.total_sales or 0)

    cur_ctr = total_clicks / total_impressions if total_impressions else None
    cur_cpc = total_cost / total_clicks if total_clicks else None
    cur_acos = total_cost / total_sales if total_sales else None
    cur_roas = total_sales / total_cost if total_cost else None
    cur_conv = total_orders / total_clicks if total_clicks else None
    cur_cpp = total_cost / total_orders if total_orders else None

    p_ctr = p_clicks / p_impressions if p_impressions else None
    p_cpc = p_cost / p_clicks if p_clicks else None
    p_acos = p_cost / p_sales if p_sales else None
    p_roas = p_sales / p_cost if p_cost else None

    available_types = [
        r[0] for r in db.query(distinct(CampaignDailyMetrics.report_type)).filter(
            CampaignDailyMetrics.client_id == client_id,
            CampaignDailyMetrics.date >= start_date,
            CampaignDailyMetrics.date <= end_date,
        ).all()
    ]

    coverage_q = db.query(
        func.min(CampaignDailyMetrics.date).label("data_min"),
        func.max(CampaignDailyMetrics.date).label("data_max"),
    ).filter(CampaignDailyMetrics.client_id == client_id).first()
    data_min = coverage_q.data_min if coverage_q else None
    data_max = coverage_q.data_max if coverage_q else None

    return MetricsSummary(
        client_id=client_id,
        start_date=start_date,
        end_date=end_date,
        data_min_date=data_min,
        data_max_date=data_max,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_cost=round(total_cost, 2),
        total_sales_14d=round(total_sales, 2),
        total_purchases_14d=total_orders,
        total_units_sold=0,
        total_sales=round(total_sales, 2),
        total_purchases=total_orders,
        overall_ctr=round(cur_ctr, 6) if cur_ctr is not None else None,
        overall_cpc=round(cur_cpc, 4) if cur_cpc is not None else None,
        overall_acos=round(cur_acos, 4) if cur_acos is not None else None,
        overall_roas=round(cur_roas, 4) if cur_roas is not None else None,
        overall_conv_rate=round(cur_conv, 6) if cur_conv is not None else None,
        overall_cost_per_purchase=round(cur_cpp, 4) if cur_cpp is not None else None,
        trend_cost=_trend(total_cost, p_cost),
        trend_sales_14d=_trend(total_sales, p_sales),
        trend_acos=_trend(cur_acos or 0, p_acos or 0) if cur_acos is not None and p_acos is not None else None,
        trend_roas=_trend(cur_roas or 0, p_roas or 0) if cur_roas is not None and p_roas is not None else None,
        trend_impressions=_trend(total_impressions, p_impressions),
        trend_clicks=_trend(total_clicks, p_clicks),
        trend_ctr=_trend(cur_ctr or 0, p_ctr or 0) if cur_ctr is not None and p_ctr is not None else None,
        trend_cpc=_trend(cur_cpc or 0, p_cpc or 0) if cur_cpc is not None and p_cpc is not None else None,
        trend_conv_rate=None,
        trend_units_sold=None,
        report_types_available=sorted(available_types),
        records_count=records_count,
    )


def get_chart_data(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    report_type: Optional[str] = None,
) -> ChartData:
    q = db.query(
        CampaignDailyMetrics.date,
        func.coalesce(func.sum(CampaignDailyMetrics.impressions), 0).label("impressions"),
        func.coalesce(func.sum(CampaignDailyMetrics.clicks), 0).label("clicks"),
        func.coalesce(func.sum(CampaignDailyMetrics.spend), 0).label("cost"),
        func.coalesce(func.sum(CampaignDailyMetrics.sales), 0).label("sales"),
        func.coalesce(func.sum(CampaignDailyMetrics.orders), 0).label("orders"),
    ).filter(
        CampaignDailyMetrics.client_id == client_id,
        CampaignDailyMetrics.date >= start_date,
        CampaignDailyMetrics.date <= end_date,
    )
    if report_type:
        q = q.filter(CampaignDailyMetrics.report_type == report_type)

    rows = q.group_by(CampaignDailyMetrics.date).order_by(CampaignDailyMetrics.date).all()

    series = []
    for row in rows:
        cost = float(row.cost or 0)
        sales = float(row.sales or 0)
        acos = round(cost / sales, 4) if sales else None
        series.append(DailyDataPoint(
            date=row.date,
            impressions=int(row.impressions or 0),
            clicks=int(row.clicks or 0),
            cost=round(cost, 2),
            sales_14d=round(sales, 2),
            purchases_14d=int(row.orders or 0),
            sales=round(sales, 2),
            acos=acos,
        ))

    breakdown_q = db.query(
        CampaignDailyMetrics.report_type,
        func.coalesce(func.sum(CampaignDailyMetrics.spend), 0).label("spend"),
        func.coalesce(func.sum(CampaignDailyMetrics.sales), 0).label("sales"),
    ).filter(
        CampaignDailyMetrics.client_id == client_id,
        CampaignDailyMetrics.date >= start_date,
        CampaignDailyMetrics.date <= end_date,
    )
    if report_type:
        breakdown_q = breakdown_q.filter(CampaignDailyMetrics.report_type == report_type)

    breakdown_rows = breakdown_q.group_by(CampaignDailyMetrics.report_type).all()

    sp_spend = sb_spend = sd_spend = 0.0
    sp_sales = sb_sales = sd_sales = 0.0
    for r in breakdown_rows:
        rt = r.report_type or ""
        spend = float(r.spend or 0)
        sales = float(r.sales or 0)
        if rt == _SP_CAMPAIGNS:
            sp_spend += spend
            sp_sales += sales
        elif rt == _SB_CAMPAIGNS:
            sb_spend += spend
            sb_sales += sales
        elif rt == _SD_CAMPAIGNS:
            sd_spend += spend
            sd_sales += sales

    ad_type_breakdown = []
    if sp_spend or sp_sales:
        ad_type_breakdown.append(AdTypeBreakdown(ad_type="SP", spend=round(sp_spend, 2), sales=round(sp_sales, 2)))
    if sb_spend or sb_sales:
        ad_type_breakdown.append(AdTypeBreakdown(ad_type="SB", spend=round(sb_spend, 2), sales=round(sb_sales, 2)))
    if sd_spend or sd_sales:
        ad_type_breakdown.append(AdTypeBreakdown(ad_type="SD", spend=round(sd_spend, 2), sales=round(sd_sales, 2)))

    return ChartData(
        client_id=client_id,
        start_date=start_date,
        end_date=end_date,
        series=series,
        ad_type_breakdown=ad_type_breakdown,
    )


def get_search_terms(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    limit: int = 50,
    sort_by: str = "cost",
) -> list[SearchTermRow]:
    sort_map = {
        "cost": func.sum(SearchTermDaily.spend),
        "acos": func.sum(SearchTermDaily.spend) / func.nullif(func.sum(SearchTermDaily.sales), 0),
        "clicks": func.sum(SearchTermDaily.clicks),
        "sales": func.sum(SearchTermDaily.sales),
        "impressions": func.sum(SearchTermDaily.clicks),
    }
    order_col = sort_map.get(sort_by, func.sum(SearchTermDaily.spend))

    rows = (
        db.query(
            SearchTermDaily.search_term,
            SearchTermDaily.keyword,
            SearchTermDaily.match_type,
            func.coalesce(func.sum(SearchTermDaily.clicks), 0).label("clicks"),
            func.coalesce(func.sum(SearchTermDaily.spend), 0).label("cost"),
            func.coalesce(func.sum(SearchTermDaily.sales), 0).label("sales"),
            func.coalesce(func.sum(SearchTermDaily.orders), 0).label("orders"),
        )
        .filter(
            SearchTermDaily.client_id == client_id,
            SearchTermDaily.date >= start_date,
            SearchTermDaily.date <= end_date,
        )
        .group_by(SearchTermDaily.search_term, SearchTermDaily.keyword, SearchTermDaily.match_type)
        .order_by(order_col.desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        cost = float(r.cost or 0)
        sales = float(r.sales or 0)
        clicks = int(r.clicks or 0)
        orders = int(r.orders or 0)
        result.append(SearchTermRow(
            search_term=r.search_term or "",
            keyword=r.keyword,
            match_type=r.match_type,
            impressions=0,
            clicks=clicks,
            cost=round(cost, 2),
            sales_14d=round(sales, 2),
            purchases_14d=orders,
            acos=round(cost / sales, 4) if sales else None,
            conv_rate=round(orders / clicks, 6) if clicks else None,
        ))
    return result


def get_keywords(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    limit: int = 50,
    sort_by: str = "cost",
) -> list[KeywordRow]:
    sort_map = {
        "cost": func.sum(TargetingDaily.spend),
        "acos": func.sum(TargetingDaily.spend) / func.nullif(func.sum(TargetingDaily.sales), 0),
        "clicks": func.sum(TargetingDaily.clicks),
        "sales": func.sum(TargetingDaily.sales),
        "impressions": func.sum(TargetingDaily.impressions),
    }
    order_col = sort_map.get(sort_by, func.sum(TargetingDaily.spend))

    rows = (
        db.query(
            TargetingDaily.target,
            TargetingDaily.target_type,
            func.max(TargetingDaily.bid).label("bid"),
            func.coalesce(func.sum(TargetingDaily.impressions), 0).label("impressions"),
            func.coalesce(func.sum(TargetingDaily.clicks), 0).label("clicks"),
            func.coalesce(func.sum(TargetingDaily.spend), 0).label("cost"),
            func.coalesce(func.sum(TargetingDaily.sales), 0).label("sales"),
            func.coalesce(func.sum(TargetingDaily.orders), 0).label("orders"),
        )
        .filter(
            TargetingDaily.client_id == client_id,
            TargetingDaily.report_type == _SP_TARGETING,
            TargetingDaily.date >= start_date,
            TargetingDaily.date <= end_date,
        )
        .group_by(TargetingDaily.target, TargetingDaily.target_type)
        .order_by(order_col.desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        cost = float(r.cost or 0)
        sales = float(r.sales or 0)
        clicks = int(r.clicks or 0)
        orders = int(r.orders or 0)
        result.append(KeywordRow(
            keyword=r.target,
            targeting_text=r.target,
            match_type=r.target_type,
            keyword_bid=float(r.bid) if r.bid is not None else None,
            impressions=int(r.impressions or 0),
            clicks=clicks,
            cost=round(cost, 2),
            sales_14d=round(sales, 2),
            purchases_14d=orders,
            acos=round(cost / sales, 4) if sales else None,
            conv_rate=round(orders / clicks, 6) if clicks else None,
        ))
    return result


def get_products(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    limit: int = 20,
) -> list[ProductRow]:
    rows = (
        db.query(
            ProductAdsDaily.asin,
            ProductAdsDaily.sku,
            func.coalesce(func.sum(ProductAdsDaily.impressions), 0).label("impressions"),
            func.coalesce(func.sum(ProductAdsDaily.clicks), 0).label("clicks"),
            func.coalesce(func.sum(ProductAdsDaily.spend), 0).label("cost"),
            func.coalesce(func.sum(ProductAdsDaily.sales), 0).label("sales"),
            func.coalesce(func.sum(ProductAdsDaily.orders), 0).label("orders"),
            func.count(distinct(ProductAdsDaily.campaign_id)).label("campaigns_count"),
        )
        .filter(
            ProductAdsDaily.client_id == client_id,
            ProductAdsDaily.date >= start_date,
            ProductAdsDaily.date <= end_date,
            ProductAdsDaily.asin.isnot(None),
        )
        .group_by(ProductAdsDaily.asin, ProductAdsDaily.sku)
        .order_by(func.sum(ProductAdsDaily.spend).desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        cost = float(r.cost or 0)
        sales = float(r.sales or 0)
        result.append(ProductRow(
            advertised_asin=r.asin,
            advertised_sku=r.sku,
            impressions=int(r.impressions or 0),
            clicks=int(r.clicks or 0),
            cost=round(cost, 2),
            sales_14d=round(sales, 2),
            purchases_14d=int(r.orders or 0),
            units_sold=0,
            acos=round(cost / sales, 4) if sales else None,
            campaigns_count=int(r.campaigns_count or 0),
        ))
    return result


def get_products_daily(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    limit: int = 500,
) -> list[ProductDailyRow]:
    rows = (
        db.query(
            ProductAdsDaily.date,
            ProductAdsDaily.asin,
            ProductAdsDaily.sku,
            func.coalesce(func.sum(ProductAdsDaily.impressions), 0).label("impressions"),
            func.coalesce(func.sum(ProductAdsDaily.clicks), 0).label("clicks"),
            func.coalesce(func.sum(ProductAdsDaily.spend), 0).label("cost"),
            func.coalesce(func.sum(ProductAdsDaily.sales), 0).label("sales"),
            func.coalesce(func.sum(ProductAdsDaily.orders), 0).label("orders"),
            func.count(distinct(ProductAdsDaily.campaign_id)).label("campaigns_count"),
        )
        .filter(
            ProductAdsDaily.client_id == client_id,
            ProductAdsDaily.date >= start_date,
            ProductAdsDaily.date <= end_date,
            ProductAdsDaily.asin.isnot(None),
        )
        .group_by(ProductAdsDaily.date, ProductAdsDaily.asin, ProductAdsDaily.sku)
        .order_by(ProductAdsDaily.date.desc(), func.sum(ProductAdsDaily.spend).desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        cost = float(r.cost or 0)
        sales = float(r.sales or 0)
        result.append(ProductDailyRow(
            metric_date=str(r.date),
            advertised_asin=r.asin,
            advertised_sku=r.sku,
            impressions=int(r.impressions or 0),
            clicks=int(r.clicks or 0),
            cost=round(cost, 2),
            sales_14d=round(sales, 2),
            purchases_14d=int(r.orders or 0),
            units_sold=0,
            acos=round(cost / sales, 4) if sales else None,
            campaigns_count=int(r.campaigns_count or 0),
        ))
    return result


def _build_campaign_row(r) -> CampaignRow:
    spend = float(r.spend or 0)
    sales = float(r.sales or 0)
    clicks = int(r.clicks or 0)
    impressions = int(r.impressions or 0)
    purchases = int(r.orders or 0)
    return CampaignRow(
        campaign_id=int(r.campaign_id),
        campaign_name=r.campaign_name,
        campaign_status=r.status,
        report_type=r.report_type,
        budget=float(r.budget) if r.budget is not None else None,
        spend=round(spend, 2),
        sales=round(sales, 2),
        roas=round(sales / spend, 4) if spend else None,
        acos=round(spend / sales, 4) if sales else None,
        impressions=impressions,
        clicks=clicks,
        ctr=round(clicks / impressions, 6) if impressions else None,
        cpc=round(spend / clicks, 4) if clicks else None,
        purchases=purchases,
        units_sold=0,
        detail_page_views=None,
        viewable_impressions=None,
        top_of_search_impression_share=None,
        cost_type=None,
        ntb_purchases=None,
        ntb_sales=None,
    )


def get_campaigns(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    report_type: Optional[str] = None,
    limit: int = 200,
) -> list[CampaignRow]:
    q = (
        db.query(
            CampaignDailyMetrics.campaign_id,
            CampaignDailyMetrics.campaign_name,
            CampaignDailyMetrics.report_type,
            func.coalesce(func.sum(CampaignDailyMetrics.impressions), 0).label("impressions"),
            func.coalesce(func.sum(CampaignDailyMetrics.clicks), 0).label("clicks"),
            func.coalesce(func.sum(CampaignDailyMetrics.spend), 0).label("spend"),
            func.coalesce(func.sum(CampaignDailyMetrics.sales), 0).label("sales"),
            func.coalesce(func.sum(CampaignDailyMetrics.orders), 0).label("orders"),
            CampaignsMaster.status,
            CampaignsMaster.daily_budget.label("budget"),
        )
        .outerjoin(
            CampaignsMaster,
            and_(
                CampaignsMaster.campaign_id == CampaignDailyMetrics.campaign_id,
                CampaignsMaster.client_id == CampaignDailyMetrics.client_id,
            ),
        )
        .filter(
            CampaignDailyMetrics.client_id == client_id,
            CampaignDailyMetrics.date >= start_date,
            CampaignDailyMetrics.date <= end_date,
        )
    )
    if report_type:
        q = q.filter(CampaignDailyMetrics.report_type == report_type)

    rows = (
        q.group_by(
            CampaignDailyMetrics.campaign_id,
            CampaignDailyMetrics.campaign_name,
            CampaignDailyMetrics.report_type,
            CampaignsMaster.status,
            CampaignsMaster.daily_budget,
        )
        .having(func.sum(CampaignDailyMetrics.impressions) > 0)
        .order_by(func.sum(CampaignDailyMetrics.spend).desc())
        .limit(limit)
        .all()
    )

    return [_build_campaign_row(r) for r in rows]


def get_dashboard_summary(
    db: Session,
    client_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    top_n: int = 5,
) -> DashboardSummary:
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=29)

    def _top_campaigns(order_col):
        rows = (
            db.query(
                CampaignDailyMetrics.campaign_id,
                CampaignDailyMetrics.campaign_name,
                func.coalesce(func.sum(CampaignDailyMetrics.spend), 0).label("total_cost"),
                func.coalesce(func.sum(CampaignDailyMetrics.impressions), 0).label("total_impressions"),
                func.coalesce(func.sum(CampaignDailyMetrics.clicks), 0).label("total_clicks"),
                func.coalesce(func.sum(CampaignDailyMetrics.sales), 0).label("total_sales"),
            )
            .filter(
                CampaignDailyMetrics.client_id == client_id,
                CampaignDailyMetrics.date >= start_date,
                CampaignDailyMetrics.date <= end_date,
            )
            .group_by(CampaignDailyMetrics.campaign_id, CampaignDailyMetrics.campaign_name)
            .order_by(order_col.desc())
            .limit(top_n)
            .all()
        )
        return [
            TopCampaign(
                campaign_id=int(r.campaign_id),
                campaign_name=r.campaign_name,
                total_cost=round(float(r.total_cost or 0), 2),
                total_impressions=int(r.total_impressions or 0),
                total_clicks=int(r.total_clicks or 0),
                total_sales_14d=round(float(r.total_sales or 0), 2),
            )
            for r in rows
        ]

    by_cost = _top_campaigns(func.sum(CampaignDailyMetrics.spend))
    by_sales = _top_campaigns(func.sum(CampaignDailyMetrics.sales))

    last_fetch = (
        db.query(ReportFetch)
        .filter(ReportFetch.client_id == client_id, ReportFetch.status == "completed")
        .order_by(ReportFetch.fetched_at.desc())
        .first()
    )
    last_fetch_at = last_fetch.fetched_at.isoformat() if last_fetch and last_fetch.fetched_at else None

    active_types = [
        r[0] for r in db.query(distinct(CampaignDailyMetrics.report_type))
        .filter(CampaignDailyMetrics.client_id == client_id, CampaignDailyMetrics.date >= start_date)
        .all()
    ]

    return DashboardSummary(
        client_id=client_id,
        top_campaigns_by_cost=by_cost,
        top_campaigns_by_sales=by_sales,
        last_fetch_at=last_fetch_at,
        active_report_types=sorted(active_types),
    )


def get_placements(
    db: Session,
    client_id: int,
    start_date: date,
    end_date: date,
    report_type: Optional[str] = None,
) -> list[PlacementRow]:
    q = (
        db.query(
            PlacementDaily.placement,
            PlacementDaily.report_type,
            func.coalesce(func.sum(PlacementDaily.impressions), 0).label("impressions"),
            func.coalesce(func.sum(PlacementDaily.clicks), 0).label("clicks"),
            func.coalesce(func.sum(PlacementDaily.spend), 0).label("spend"),
            func.coalesce(func.sum(PlacementDaily.sales), 0).label("sales"),
            func.coalesce(func.sum(PlacementDaily.orders), 0).label("orders"),
        )
        .filter(
            PlacementDaily.client_id == client_id,
            PlacementDaily.date >= start_date,
            PlacementDaily.date <= end_date,
        )
    )
    if report_type:
        q = q.filter(PlacementDaily.report_type == report_type)

    rows = (
        q.group_by(PlacementDaily.placement, PlacementDaily.report_type)
        .order_by(func.sum(PlacementDaily.spend).desc())
        .all()
    )

    result = []
    for r in rows:
        spend = float(r.spend or 0)
        sales = float(r.sales or 0)
        clicks = int(r.clicks or 0)
        impressions = int(r.impressions or 0)
        result.append(PlacementRow(
            placement=r.placement or "Unknown",
            report_type=r.report_type,
            impressions=impressions,
            clicks=clicks,
            cost=round(spend, 2),
            sales=round(sales, 2),
            orders=int(r.orders or 0),
            acos=round(spend / sales, 4) if sales else None,
            roas=round(sales / spend, 4) if spend else None,
            ctr=round(clicks / impressions, 6) if impressions else None,
            cpc=round(spend / clicks, 4) if clicks else None,
        ))
    return result
