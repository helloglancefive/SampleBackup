import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.rate_limit import limiter
from config import get_settings
from app.routes.health import router as health_router
from app.routes.v1.auth import router as auth_router
from app.routes.v1.users import router as users_router
from app.routes.v1.clients import router as clients_router
from app.routes.v1.reports import router as reports_router
from app.routes.v1.dashboard import router as dashboard_router
from app.routes.v1.notifications import router as notifications_router
from app.routes.v1.sp_business import router as sp_business_router
from app.routes.v1.amazon_auth import router as amazon_auth_router
from app.routes.v1.subscriptions import router as subscriptions_router
from app.routes.websockets import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.websockets.redis_listener import start_listener
    listener_task = asyncio.create_task(start_listener())
    yield
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="GlanceFive Amazon Ads Platform",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(clients_router)
    app.include_router(reports_router)
    app.include_router(dashboard_router)
    app.include_router(notifications_router)
    app.include_router(sp_business_router)
    app.include_router(amazon_auth_router)
    app.include_router(subscriptions_router)
    app.include_router(ws_router)

    return app


app = create_app()
