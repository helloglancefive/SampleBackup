"""Distributed Redis lock — prevents duplicate concurrent report fetches for the same client."""
import redis as redis_lib


class LockAlreadyHeld(Exception):
    pass


class RedisLock:
    """Context manager that acquires a Redis SET NX EX lock."""

    def __init__(self, redis_client: redis_lib.Redis, key: str, expire_seconds: int = 3600):
        self._redis = redis_client
        self._key = key
        self._expire = expire_seconds
        self._acquired = False

    def __enter__(self) -> "RedisLock":
        acquired = self._redis.set(self._key, "1", nx=True, ex=self._expire)
        if not acquired:
            raise LockAlreadyHeld(f"Lock already held: {self._key}")
        self._acquired = True
        return self

    def __exit__(self, *_) -> None:
        if self._acquired:
            self._redis.delete(self._key)
            self._acquired = False


def get_redis_client(redis_url: str) -> redis_lib.Redis:
    return redis_lib.from_url(redis_url, decode_responses=True)
