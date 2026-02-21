from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_backend_server_path = Path(__file__).parent / "kartli-challenge-main" / "backend" / "server.py"

spec = importlib.util.spec_from_file_location("backend_server", _backend_server_path)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not load backend server module from: {_backend_server_path}")

backend_server = importlib.util.module_from_spec(spec)
sys.modules["backend_server"] = backend_server
spec.loader.exec_module(backend_server)

app = backend_server.app
