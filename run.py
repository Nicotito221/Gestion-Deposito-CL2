import sys
from pathlib import Path
import uvicorn

BASE_DIR = Path(__file__).resolve().parent
backend_dir = BASE_DIR / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, app_dir=str(backend_dir))
