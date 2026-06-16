from datetime import date
from typing import Optional
from pydantic import BaseModel


class MetricsSummary(BaseModel):
    client_id: int
    start_date: date
    end_date: date
    # Actual data coverage (earliest and latest metric_date in DB for this client)
    data_min_date: Optional[date] = None
    data_max_date: Optional[date] = None
    # Volume
    total_impressions: int = 0
    total_clicks: int = 0
    total_cost: float = 0.0
    # SP windowed
    total_sales_14d: float = 0.0
    total_purchases_14d: int = 0
    total_units_sold: int = 0
    # SB/SD non-windowed
    total_sales: float = 0.0
    total_purchases: int = 0
    # Computed ratios (null when denominator is 0)
    overall_ctr: Optional[float] = None
    overall_cpc: Optional[float] = None
    overall_acos: Optional[float] = None
    overall_roas: Optional[float] = None
    overall_conv_rate: Optional[float] = None
    overall_cost_per_purchase: Optional[float] = None
    # Period-over-period % change (positive = up, negative = down, null = no prev data)
    trend_cost: Optional[float] = None
    trend_sales_14d: Optional[float] = None
    trend_acos: Optional[float] = None
    trend_roas: Optional[float] = None
    trend_impressions: Optional[float] = None
    trend_clicks: Optional[float] = None
    trend_ctr: Optional[float] = None
    trend_cpc: Optional[float] = None
    trend_conv_rate: Optional[float] = None
    trend_units_sold: Optional[float] = None
    # Report coverage
    report_types_available: list[str] = []
    records_count: int = 0


class DailyDataPoint(BaseModel):
    date: date
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    sales_14d: float = 0.0
    purchases_14d: int = 0
    sales: float = 0.0
    acos: Optional[float] = None


class AdTypeBreakdown(BaseModel):
    ad_type: str   # "SP" | "SB" | "SD"
    spend: float
    sales: float


class ChartData(BaseModel):
    client_id: int
    start_date: date
    end_date: date
    series: list[DailyDataPoint]
    ad_type_breakdown: list[AdTypeBreakdown] = []


class TopCampaign(BaseModel):
    campaign_id: int
    campaign_name: Optional[str]
    total_cost: float
    total_impressions: int
    total_clicks: int
    total_sales_14d: float


class DashboardSummary(BaseModel):
    client_id: int
    top_campaigns_by_cost: list[TopCampaign] = []
    top_campaigns_by_sales: list[TopCampaign] = []
    last_fetch_at: Optional[str] = None
    active_report_types: list[str] = []


class SearchTermRow(BaseModel):
    search_term: str
    keyword: Optional[str] = None
    match_type: Optional[str] = None
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    sales_14d: float = 0.0
    purchases_14d: int = 0
    acos: Optional[float] = None
    conv_rate: Optional[float] = None


class KeywordRow(BaseModel):
    keyword: Optional[str] = None
    targeting_text: Optional[str] = None
    match_type: Optional[str] = None
    keyword_bid: Optional[float] = None
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    sales_14d: float = 0.0
    purchases_14d: int = 0
    acos: Optional[float] = None
    conv_rate: Optional[float] = None


class ProductRow(BaseModel):
    advertised_asin: Optional[str] = None
    advertised_sku: Optional[str] = None
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    sales_14d: float = 0.0
    purchases_14d: int = 0
    units_sold: int = 0
    acos: Optional[float] = None
    campaigns_count: int = 0


class ProductDailyRow(BaseModel):
    metric_date: str
    advertised_asin: Optional[str] = None
    advertised_sku: Optional[str] = None
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    sales_14d: float = 0.0
    purchases_14d: int = 0
    units_sold: int = 0
    acos: Optional[float] = None
    campaigns_count: int = 0


class PlacementRow(BaseModel):
    placement: str
    report_type: str
    impressions: int = 0
    clicks: int = 0
    cost: float = 0.0
    sales: float = 0.0
    orders: int = 0
    acos: Optional[float] = None
    roas: Optional[float] = None
    ctr: Optional[float] = None
    cpc: Optional[float] = None


class CampaignRow(BaseModel):
    campaign_id: int
    campaign_name: Optional[str] = None
    campaign_status: Optional[str] = None
    report_type: Optional[str] = None
    budget: Optional[float] = None
    spend: float = 0.0
    sales: float = 0.0
    roas: Optional[float] = None
    acos: Optional[float] = None
    impressions: int = 0
    clicks: int = 0
    ctr: Optional[float] = None
    cpc: Optional[float] = None
    purchases: int = 0
    units_sold: int = 0
    detail_page_views: Optional[int] = None
    viewable_impressions: Optional[int] = None
    top_of_search_impression_share: Optional[float] = None
    cost_type: Optional[str] = None
    ntb_purchases: Optional[int] = None
    ntb_sales: Optional[float] = None
