from celery import Celery
from celery.schedules import crontab

from config import get_settings


def create_celery() -> Celery:
    settings = get_settings()
    app = Celery("glancefive")
    app.conf.update(
        broker_url=settings.celery_broker_url,
        result_backend=settings.celery_result_url,
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        broker_connection_retry_on_startup=False,
        broker_connection_max_retries=1,
        broker_transport_options={
            "socket_connect_timeout": 2,
            "socket_timeout": 2,
            "retry_policy": {"timeout": 2},
        },
        redis_socket_connect_timeout=2,
        redis_socket_timeout=2,
        include=[
            "app.tasks.fetch_reports",
            "app.tasks.fetch_sp_reports",
        ],
        beat_schedule={
            # 02:00 UTC — fetch all 18 Amazon Ads report types for every client
            "daily-ads-fetch-all-clients": {
                "task": "app.tasks.fetch_reports.daily_fetch_all_clients",
                "schedule": crontab(hour=2, minute=0),
            },
            # 02:30 UTC — fetch SP-API Business Reports (last 30 days) for clients with SP access
            "daily-sp-fetch-all-clients": {
                "task": "app.tasks.fetch_sp_reports.daily_sp_fetch_all_clients",
                "schedule": crontab(hour=2, minute=30),
            },
        },
    )
    return app


celery_app = create_celery()
