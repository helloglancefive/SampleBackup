"""Background async task: subscribe to Redis pub/sub and forward events to WebSocket clients."""
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

_PATTERN = "ws:events:*"


async def start_listener() -> None:
    """Subscribe to all ws:events:* channels and forward to the in-process ConnectionManager.
    Silently exits if Redis is unavailable (WebSocket events work within a single process without it).
    """
    try:
        import redis.asyncio as aioredis
        from config import get_settings
        from app.websockets.connection_manager import manager

        settings = get_settings()
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.psubscribe(_PATTERN)
        logger.info("Redis pub/sub listener started on pattern %s", _PATTERN)

        async for message in pubsub.listen():
            if message is None:
                continue
            if message.get("type") not in ("pmessage", "message"):
                continue
            try:
                channel: str = message.get("channel", "")
                raw_data = message.get("data", "{}")
                payload = json.loads(raw_data)
                # Channel format: ws:events:client:{client_id} or ws:events:user:{user_id}
                key = channel.replace("ws:events:", "", 1)
                await manager.broadcast(key, payload)
            except Exception as exc:
                logger.debug("Redis listener parse error: %s", exc)

    except asyncio.CancelledError:
        logger.info("Redis pub/sub listener cancelled")
    except Exception as exc:
        logger.warning("Redis pub/sub listener unavailable: %s — WS events limited to single process", exc)


def publish_event(channel_key: str, payload: dict, redis_url: str) -> None:
    """Synchronous publish — called from Celery workers."""
    try:
        import redis
        import json as _json
        r = redis.from_url(redis_url, decode_responses=True)
        r.publish(f"ws:events:{channel_key}", _json.dumps(payload))
    except Exception as exc:
        logger.debug("Redis publish failed (non-critical): %s", exc)
