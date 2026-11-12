from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from scripts.private_app import configure_private_app


def test_private_site_serves_only_public_build_and_keeps_api_authentication(tmp_path: Path):
    public = tmp_path / "site"
    public.mkdir()
    (public / "index.html").write_text("<title>datacube</title>", encoding="utf-8")
    (tmp_path / "solves.db").write_text("private", encoding="utf-8")
    app = FastAPI()

    @app.get("/api/auth/me")
    def me():
        raise HTTPException(401, "sign in required")

    configure_private_app(app, public, "datacube-pc.tail-test.ts.net")
    with TestClient(app, base_url="https://datacube-pc.tail-test.ts.net") as client:
        assert client.get("/").status_code == 200
        assert client.get("/api/auth/me").status_code == 401
        assert client.get("/solves.db").status_code == 404
        assert client.get("/site/../solves.db").status_code == 404
        assert client.get("/api/not-a-route").status_code == 404
        assert client.get("/", headers={"host": "outside.example"}).status_code == 400


def test_private_site_rejects_missing_build_and_unexpected_hostname(tmp_path: Path):
    with pytest.raises(RuntimeError):
        configure_private_app(FastAPI(), tmp_path)
    (tmp_path / "index.html").write_text("datacube", encoding="utf-8")
    with pytest.raises(ValueError):
        configure_private_app(FastAPI(), tmp_path, "outside.example")
