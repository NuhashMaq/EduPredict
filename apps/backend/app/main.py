from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.settings import get_settings
from app.routers import academics, admin, auth, bootstrap, health, ml, users


def create_app() -> FastAPI:
    settings = get_settings()
    settings.validate_runtime_config()
    app = FastAPI(
        title="EduPredict API",
        version="0.1.0",
        description="EduPredict backend: RBAC + ML prediction + explainability.",
        debug=settings.app_debug,
    )

    @app.get("/", tags=["meta"])
    async def root():
        return {
            "name": "EduPredict API",
            "status": "ok",
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health",
        }

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(admin.router)
    app.include_router(bootstrap.router)
    app.include_router(academics.router)
    app.include_router(ml.router)
    app.include_router(health.router)

    return app


app = create_app()
