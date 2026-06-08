"""Embed the vendored adobe2api FastAPI app under the Grok2API process."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType

from fastapi import FastAPI


_MODULE_NAME = "grok2api_vendor_adobe2api"
_cached_module: ModuleType | None = None


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _vendor_dir() -> Path:
    return _repo_root() / "vendor" / "adobe2api"


def load_adobe2api_app() -> FastAPI:
    """Load the vendored adobe2api app without starting a second server."""

    global _cached_module
    if _cached_module is not None:
        return _cached_module.app

    vendor_dir = _vendor_dir()
    entrypoint = vendor_dir / "app.py"
    if not entrypoint.exists():
        raise RuntimeError(f"adobe2api entrypoint not found: {entrypoint}")

    os.environ.setdefault("ADOBE2API_MOUNT_PATH", "/adobe")

    previous_sys_path = list(sys.path)
    sys.path.insert(0, str(vendor_dir))
    try:
        spec = importlib.util.spec_from_file_location(_MODULE_NAME, entrypoint)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"unable to load adobe2api from: {entrypoint}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[_MODULE_NAME] = module
        spec.loader.exec_module(module)
    finally:
        sys.path[:] = previous_sys_path

    adobe_app = getattr(module, "app", None)
    if not isinstance(adobe_app, FastAPI):
        raise RuntimeError("vendored adobe2api did not expose a FastAPI app")

    _cached_module = module
    return adobe_app
