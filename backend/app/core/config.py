import os
from typing import Optional
import pyodbc

DB_SERVER: str = os.getenv("DB_SERVER", r".\SQLEXPRESS")
DB_NAME: str = os.getenv("DB_NAME", "GestionDeposito")
DB_DRIVER: str = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server")
DB_TRUSTED_CONNECTION: str = os.getenv("DB_TRUSTED_CONNECTION", "yes")
DB_TRUST_SERVER_CERTIFICATE: str = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "yes")
DB_USER: Optional[str] = os.getenv("DB_USER", None)
DB_PASSWORD: Optional[str] = os.getenv("DB_PASSWORD", None)


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
