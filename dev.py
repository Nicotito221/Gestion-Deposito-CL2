import os
import sys
import time
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"


def kill_proc_tree(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
    else:
        try:
            os.kill(pid, 15)
        except ProcessLookupError:
            pass


def stream_logs(proc: subprocess.Popen, prefix: str) -> None:
    if proc.stdout is None:
        return
    for line in iter(proc.stdout.readline, ""):
        if line:
            print(f"{prefix} {line.rstrip()}", flush=True)


def main() -> None:
    print("=" * 64, flush=True)
    print(" INICIANDO BACKEND (FastAPI :8000) Y FRONTEND (Vite :5173)", flush=True)
    print(" Presione Ctrl + C para detener ambos procesos limpiamente", flush=True)
    print("=" * 64, flush=True)

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    backend_cmd = [
        sys.executable,
        "-u",
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--app-dir",
        str(BACKEND_DIR),
        "--port",
        "8000",
    ]

    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    npm_bin = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_bin, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    t1 = threading.Thread(
        target=stream_logs,
        args=(backend_proc, "\033[94m[BACKEND]\033[0m"),
        daemon=True,
    )
    t2 = threading.Thread(
        target=stream_logs,
        args=(frontend_proc, "\033[92m[FRONTEND]\033[0m"),
        daemon=True,
    )
    t1.start()
    t2.start()

    try:
        while True:
            if backend_proc.poll() is not None:
                print("\n[AVISO] El proceso de backend ha finalizado.")
                break
            if frontend_proc.poll() is not None:
                print("\n[AVISO] El proceso de frontend ha finalizado.")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nDeteniendo servicios...")
    finally:
        kill_proc_tree(backend_proc.pid)
        kill_proc_tree(frontend_proc.pid)
        print("Servicios finalizados con éxito.")


if __name__ == "__main__":
    main()
