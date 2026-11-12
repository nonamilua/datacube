"""Serve a built datacube frontend and its API on localhost for Tailscale Serve."""

import json
import os
from pathlib import Path
import re

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

ROOT = Path(__file__).resolve().parent.parent
PRIVATE_DIRECTORY = ROOT / ".venv" / "private-access"


def configure_private_app(app: FastAPI, directory: Path, hostname: str = "") -> FastAPI:
    """Only publish built public assets; retain the existing authenticated API."""
    if not (directory / "index.html").is_file():
        raise RuntimeError("Build the private frontend with scripts/private-access.ps1 -Build first")
    allowed_hosts = ["127.0.0.1", "localhost"]
    if hostname:
        if not re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net", hostname):
            raise ValueError("Expected a Tailscale ts.net hostname")
        allowed_hosts.append(hostname)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
    # Existing /api routes are registered first, before this static catch-all.
    app.mount("/", StaticFiles(directory=directory, html=True), name="private-frontend")
    return app


def main() -> None:
    import uvicorn

    # This process is reached by browsers over Tailscale HTTPS only.
    os.environ["COOKIE_SECURE"] = "true"
    config_file = PRIVATE_DIRECTORY / "settings.json"
    config = json.loads(config_file.read_text(encoding="utf-8-sig")) if config_file.exists() else {}
    from backend.main import app

    configure_private_app(app, PRIVATE_DIRECTORY / "site", config.get("hostname", ""))
    uvicorn.run(app, host="127.0.0.1", port=8765, proxy_headers=False)


if __name__ == "__main__":
    main()
