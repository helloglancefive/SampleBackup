"""Celery tasks for Amazon Advertising report fetching."""
import logging
import time
from datetime import datetime, timedelta, timezone

from celery_app import celery_app


def _publish(client_id: int, payload: dict) -> None:
    try:
        from config import get_settings
        from app.websockets.redis_listener import publish_event
        publish_event(f"client:{client_id}", payload, get_settings().redis_url)
    except Exception:
        pass

logger = logging.getLogger(__name__)

ALL_REPORT_TYPES = [
    # Sponsored Products (7)
    "spCampaigns", "spCampaignPlacement", "spTargeting", "spSearchTerm",
    "spProductAds", "spPurchasedProduct", "spGrossAndInvalids",
    # Sponsored Brands (5)
    "sbCampaigns", "sbCampaignPlacement", "sbTargeting", "sbSearchTerm", "sbGrossAndInvalids",
    # Sponsored Display (6)
    "sdCampaigns", "sdMatchedTarget", "sdAdvertising", "sdTargeting",
    "sdPurchasedProduct", "sdGrossAndInvalids",
]

# SD reports frequently return empty — treat as expected, not errors
SD_REPORT_TYPES = {
    "sdAdvertising", "sdTargeting", "sdCampaigns", "sdMatchedTarget",
    "sdPurchasedProduct", "sdGrossAndInvalids",
}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120, name="app.tasks.fetch_reports.fetch_reports_for_client")
def fetch_reports_for_client(
    self,
    client_id: int,
    report_types: list,
    start_date: str,
    end_date: str,
    triggered_by: str = "on_demand",
    triggered_by_user_id: int = None,
) -> dict:
    """Fetch and store one or more report types for a single client."""
    from config import get_settings
    from app.dependencies import SessionLocal
    from app.models import Client, ClientAmazonCredentials, ReportFetch
    from app.security.encryption import decrypt_credential
    from app.services.amazon_auth_service import AmazonAuthService
    from app.services.profile_service import ProfileService
    from app.services.report_service import ReportService

    settings = get_settings()
    db = SessionLocal()

    try:
        client = db.query(Client).filter(Client.id == client_id, Client.is_active.is_(True)).first()
        if not client:
            return {"error": f"Client {client_id} not found or inactive"}

        creds = db.query(ClientAmazonCredentials).filter(
            ClientAmazonCredentials.client_id == client_id,
            ClientAmazonCredentials.is_active.is_(True),
        ).first()
        if not creds:
            return {"error": f"No active credentials for client {client_id}"}

        if not settings.encryption_key:
            return {"error": "Encryption key not configured"}

        amazon_client_id = decrypt_credential(creds.amazon_client_id, settings.encryption_key)
        amazon_client_secret = decrypt_credential(creds.amazon_client_secret, settings.encryption_key)
        amazon_refresh_token = decrypt_credential(creds.amazon_refresh_token, settings.encryption_key)

        auth = AmazonAuthService(amazon_client_id, amazon_client_secret, amazon_refresh_token, settings)

        profile_id = str(creds.amazon_profile_id) if creds.amazon_profile_id else None
        if not profile_id:
            profile_svc = ProfileService(auth, settings)
            profile_id = profile_svc.get_primary_profile_id()
            if not profile_id:
                return {"error": "No Amazon profile found for client"}

        report_svc = ReportService(client_id, auth, profile_id, settings)
        results = {}

        for report_type in report_types:
            fetch = ReportFetch(
                client_id=client_id,
                report_type=report_type,
                status="running",
                start_date=datetime.strptime(start_date, "%Y-%m-%d"),
                end_date=datetime.strptime(end_date, "%Y-%m-%d"),
                triggered_by=triggered_by,
                triggered_by_user_id=triggered_by_user_id,
            )
            db.add(fetch)
            db.commit()
            db.refresh(fetch)

            from app.websockets.events import fetch_started, fetch_completed, fetch_failed
            _publish(client_id, fetch_started(client_id, report_type, self.request.id or ""))

            try:
                result = report_svc.fetch_and_store(db, report_type, start_date, end_date, fetch.id)
                results[report_type] = {"status": "completed", "records": result["records"]}
                _publish(client_id, fetch_completed(client_id, report_type, result["records"]))
            except RuntimeError as exc:
                error_msg = str(exc)
                fetch.status = "failed"
                fetch.error_message = error_msg
                fetch.fetched_at = datetime.now(timezone.utc)
                db.commit()
                results[report_type] = {"status": "failed", "error": error_msg}
                _publish(client_id, fetch_failed(client_id, report_type, error_msg))
                if report_type not in SD_REPORT_TYPES:
                    logger.error("fetch_reports[client=%d, type=%s]: %s", client_id, report_type, error_msg)
                else:
                    logger.info("fetch_reports[client=%d, type=%s]: %s (expected for SD)", client_id, report_type, error_msg)

            # Rate-limit delay between reports
            if report_type != report_types[-1]:
                time.sleep(5)

        return results

    except Exception as exc:
        logger.exception("fetch_reports_for_client task failed [client=%d]: %s", client_id, exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(name="app.tasks.fetch_reports.daily_fetch_all_clients")
def daily_fetch_all_clients() -> dict:
    """Scheduled task: fetch all 18 Ads report types for every active client (yesterday's data)."""
    from app.dependencies import SessionLocal
    from app.models import Client

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    db = SessionLocal()
    try:
        active_clients = db.query(Client).filter(Client.is_active.is_(True)).all()
        client_ids = [c.id for c in active_clients]
    finally:
        db.close()

    logger.info("daily_fetch_all_clients: scheduling %d clients for %s", len(client_ids), yesterday)

    for client_id in client_ids:
        fetch_reports_for_client.delay(
            client_id=client_id,
            report_types=ALL_REPORT_TYPES,
            start_date=yesterday,
            end_date=yesterday,
            triggered_by="scheduled",
        )
        time.sleep(2)  # stagger task submissions

    return {"clients_scheduled": len(client_ids), "date": yesterday}
