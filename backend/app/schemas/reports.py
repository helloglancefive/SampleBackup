from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


_ALL_REPORT_TYPES = {
    # SP
    "spCampaigns", "spCampaignPlacement", "spTargeting", "spSearchTerm",
    "spProductAds", "spPurchasedProduct", "spGrossAndInvalids",
    # SB
    "sbCampaigns", "sbCampaignPlacement", "sbTargeting", "sbSearchTerm",
    "sbGrossAndInvalids",
    # SD
    "sdCampaigns", "sdMatchedTarget", "sdAdvertising", "sdTargeting",
    "sdPurchasedProduct", "sdGrossAndInvalids",
}


class FetchRequest(BaseModel):
    client_id: Optional[int] = None  # inferred from JWT if omitted
    report_types: list[str] = sorted(_ALL_REPORT_TYPES)
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD

    @field_validator("report_types")
    @classmethod
    def validate_report_types(cls, v: list[str]) -> list[str]:
        invalid = set(v) - _ALL_REPORT_TYPES
        if invalid:
            raise ValueError(f"Invalid report types: {invalid}")
        return v


class FetchResponse(BaseModel):
    task_id: str
    client_id: int
    report_types: list[str]
    start_date: str
    end_date: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    state: str   # PENDING | STARTED | SUCCESS | FAILURE | RETRY
    result: Optional[dict] = None
    error: Optional[str] = None


class FetchHistoryItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    client_id: int
    report_type: str
    status: str
    amazon_report_id: Optional[str] = None
    records_count: Optional[int] = None
    error_message: Optional[str] = None
    fetch_time_seconds: Optional[float] = None
    triggered_by: str
    fetched_at: Optional[datetime] = None
    created_at: datetime
