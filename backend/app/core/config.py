import os
from typing import Optional
from dotenv import load_dotenv
import pyodbc

load_dotenv()

DB_SERVER: str = os.getenv("DB_SERVER", r".\SQLEXPRESS")
DB_NAME: str = os.getenv("DB_NAME", "GestionDeposito")
DB_DRIVER: str = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server")
DB_TRUSTED_CONNECTION: str = os.getenv("DB_TRUSTED_CONNECTION", "yes")
DB_TRUST_SERVER_CERTIFICATE: str = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "yes")
DB_USER: Optional[str] = os.getenv("DB_USER", None)
DB_PASSWORD: Optional[str] = os.getenv("DB_PASSWORD", None)

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-secret-key-32chars")
CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

CL2_SYNC_ENABLED: bool = os.getenv("CL2_SYNC_ENABLED", "false").lower() in ("true", "1", "yes")
CL2_API_URL: str = os.getenv("CL2_API_URL", "")
CL2_API_KEY: str = os.getenv("CL2_API_KEY", "")
CL2_HMAC_SECRET: str = os.getenv("CL2_HMAC_SECRET", "")
CL2_SYNC_INTERVAL_SECONDS: int = int(os.getenv("CL2_SYNC_INTERVAL_SECONDS", "1200"))




def get_connection_string() -> str:
    if DB_USER and DB_PASSWORD:
        return (
            f"DRIVER={{{DB_DRIVER}}};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_NAME};"
            f"UID={DB_USER};"
            f"PWD={DB_PASSWORD};"
            f"TrustServerCertificate={DB_TRUST_SERVER_CERTIFICATE};"
        )
    return (
        f"DRIVER={{{DB_DRIVER}}};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_NAME};"
        f"Trusted_Connection={DB_TRUSTED_CONNECTION};"
        f"TrustServerCertificate={DB_TRUST_SERVER_CERTIFICATE};"
    )


def get_db_connection() -> pyodbc.Connection:
    conn_str = get_connection_string()
    return pyodbc.connect(conn_str, autocommit=False)
