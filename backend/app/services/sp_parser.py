"""Parse SP-API GET_SALES_AND_TRAFFIC_REPORT (tab-separated, GZIP-compressed).

The report columns (in order from Amazon) map to product_business_daily columns.
Column names use spaces, dashes, and en-dashes — we normalise them by stripping
whitespace and lowercasing before lookup.
"""
import csv
import io
import logging
from datetime import date as date_type
from typing import Optional

logger = logging.getLogger(__name__)

# Map normalised report header → ProductBusinessDaily column name
_COL_MAP: dict[str, str] = {
    # Identity
    "date":                                     "report_date",
    "parentasin":                               "parent_asin",
    "childasin":                                "asin",
    "skus":                                     "sku",
    "title":                                    "title",

    # Sessions
    "sessions-mobileapp":                       "sessions_mobile_app",
    "sessions-mobileapp-b2b":                   "sessions_mobile_app_b2b",
    "sessions-browser":                         "sessions_browser",
    "sessions-browser-b2b":                     "sessions_browser_b2b",
    "sessions-total":                           "sessions_total",
    "sessions-total-b2b":                       "sessions_total_b2b",

    # Session Percentage
    "sessionpercentage-mobileapp":              "session_pct_mobile_app",
    "sessionpercentage-mobileapp-b2b":          "session_pct_mobile_app_b2b",
    "sessionpercentage-browser":                "session_pct_browser",
    "sessionpercentage-browser-b2b":            "session_pct_browser_b2b",
    "sessionpercentage-total":                  "session_pct_total",
    "sessionpercentage-total-b2b":              "session_pct_total_b2b",

    # Page Views
    "pageviews-mobileapp":                      "page_views_mobile_app",
    "pageviews-mobileapp-b2b":                  "page_views_mobile_app_b2b",
    "pageviews-browser":                        "page_views_browser",
    "pageviews-browser-b2b":                    "page_views_browser_b2b",
    "pageviews-total":                          "page_views_total",
    "pageviews-total-b2b":                      "page_views_total_b2b",

    # Page View Percentage
    "pageviewspercentage-mobileapp":            "page_view_pct_mobile_app",
    "pageviewspercentage-mobileapp-b2b":        "page_view_pct_mobile_app_b2b",
    "pageviewspercentage-browser":              "page_view_pct_browser",
    "pageviewspercentage-browser-b2b":          "page_view_pct_browser_b2b",
    "pageviewspercentage-total":                "page_view_pct_total",
    "pageviewspercentage-total-b2b":            "page_view_pct_total_b2b",

    # Buy Box
    "featuredofferpercentage":                  "featured_offer_pct",
    "featuredofferpercentage-b2b":              "featured_offer_pct_b2b",
    "featuredoffer-unfilledpercentage":         "unfilled_featured_offer_pct",
    "featuredoffer-unfilledpercentage-b2b":     "unfilled_featured_offer_pct_b2b",

    # Orders / Units
    "unitsordered":                             "units_ordered",
    "unitsordered-b2b":                         "units_ordered_b2b",
    "unitsessionpercentage":                    "unit_session_pct",
    "unitsessionpercentage-b2b":                "unit_session_pct_b2b",
    "orderedproductsales":                      "ordered_product_sales",
    "orderedproductsales-b2b":                  "ordered_product_sales_b2b",
    "totalorderitems":                          "total_order_items",
    "totalorderitems-b2b":                      "total_order_items_b2b",

    # Refunds
    "unitsrefunded":                            "units_refunded",
    "unitsrefunded–b2b":                   "units_refunded_b2b",   # en-dash variant
    "unitsrefunded-b2b":                        "units_refunded_b2b",
    "refundrate":                               "refund_rate",
    "refundrate–b2b":                      "refund_rate_b2b",       # en-dash variant
    "refundrate-b2b":                           "refund_rate_b2b",

    # Shipped
    "shippedproductsales":                      "shipped_product_sales",
    "shippedproductsales-b2b":                  "shipped_product_sales_b2b",
    "unitsshipped":                             "units_shipped",
    "unitsshipped-b2b":                         "units_shipped_b2b",
    "ordersshipped":                            "orders_shipped",
    "ordersshipped-b2b":                        "orders_shipped_b2b",
}

_INT_COLS = {
    "sessions_mobile_app", "sessions_mobile_app_b2b", "sessions_browser",
    "sessions_browser_b2b", "sessions_total", "sessions_total_b2b",
    "page_views_mobile_app", "page_views_mobile_app_b2b", "page_views_browser",
    "page_views_browser_b2b", "page_views_total", "page_views_total_b2b",
    "units_ordered", "units_ordered_b2b", "total_order_items", "total_order_items_b2b",
    "units_refunded", "units_refunded_b2b", "units_shipped", "units_shipped_b2b",
    "orders_shipped", "orders_shipped_b2b",
}

_FLOAT_COLS = {
    "session_pct_mobile_app", "session_pct_mobile_app_b2b", "session_pct_browser",
    "session_pct_browser_b2b", "session_pct_total", "session_pct_total_b2b",
    "page_view_pct_mobile_app", "page_view_pct_mobile_app_b2b", "page_view_pct_browser",
    "page_view_pct_browser_b2b", "page_view_pct_total", "page_view_pct_total_b2b",
    "featured_offer_pct", "featured_offer_pct_b2b",
    "unfilled_featured_offer_pct", "unfilled_featured_offer_pct_b2b",
    "unit_session_pct", "unit_session_pct_b2b",
    "ordered_product_sales", "ordered_product_sales_b2b",
    "refund_rate", "refund_rate_b2b",
    "shipped_product_sales", "shipped_product_sales_b2b",
}


def _normalise_header(raw: str) -> str:
    """Strip whitespace, collapse inner spaces/dashes, lowercase."""
    return (
        raw.strip()
           .lower()
           .replace("–", "-")   # en-dash → hyphen
           .replace("—", "-")   # em-dash → hyphen
           .replace(" - ", "-")
           .replace(" ", "")
    )


def parse_business_report(
    raw_bytes: bytes,
    client_id: int,
    marketplace_id: str,
) -> list[dict]:
    """
    Parse SP-API Business Report TSV bytes into a list of dicts
    ready to upsert into product_business_daily.
    """
    text = raw_bytes.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")

    # Build a header normalisation map: original header → normalised key
    norm_headers: dict[str, str] = {}
    if reader.fieldnames:
        for h in reader.fieldnames:
            norm_headers[h] = _normalise_header(h)

    records = []
    for row in reader:
        record: dict = {
            "client_id": client_id,
            "marketplace_id": marketplace_id,
        }

        for raw_header, norm_key in norm_headers.items():
            col_name = _COL_MAP.get(norm_key)
            if col_name is None:
                continue
            raw_val = row.get(raw_header, "").strip()
            if not raw_val or raw_val in ("--", "-", "N/A", ""):
                continue

            try:
                if col_name == "report_date":
                    record[col_name] = date_type.fromisoformat(raw_val)
                elif col_name in _INT_COLS:
                    # Remove commas (e.g. "1,234")
                    record[col_name] = int(raw_val.replace(",", ""))
                elif col_name in _FLOAT_COLS:
                    record[col_name] = float(raw_val.replace(",", "").replace("%", ""))
                else:
                    record[col_name] = raw_val
            except (ValueError, TypeError):
                logger.debug("SP-API parser: could not cast %s=%r", col_name, raw_val)
                continue

        if "report_date" not in record or "asin" not in record:
            continue

        records.append(record)

    return records
