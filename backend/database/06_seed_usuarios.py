import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pyodbc
from app.core.config import get_connection_string
from app.core.security import hash_password

INITIAL_USERS = [
    {
        "username": "admin",
        "password": "admin",
        "nombre": "Administrador",
        "apellido": "Sistema",
        "rol": "administrador",
        "sector": "TODOS",
        "email": "admin@gestiondeposito.com",
    },
    {
        "username": "gerente",
        "password": "gerente",
        "nombre": "Esteban",
        "apellido": "Martínez",
        "rol": "gerente",
        "sector": "TODOS",
        "email": "esteban.gerencia@gestiondeposito.com",
    },
    {
        "username": "jefe",
        "password": "jefe",
        "nombre": "Nicolás",
        "apellido": "Angerosa",
        "rol": "jefe",
        "sector": "TODOS",
        "email": "nicolas.jefatura@gestiondeposito.com",
    },
    {
        "username": "analista",
        "password": "analista",
        "nombre": "Florencia",
        "apellido": "Suárez",
        "rol": "analista",
        "sector": "TODOS",
        "email": "florencia.analista@gestiondeposito.com",
    },
    {
        "username": "deposito",
        "password": "deposito",
        "nombre": "Diego",
        "apellido": "López",
        "rol": "deposito",
        "sector": "CL2",
        "email": "diego.deposito@gestiondeposito.com",
    },
    {
        "username": "contador",
        "password": "contador",
        "nombre": "Mariana",
        "apellido": "Gómez",
        "rol": "contador_ciclico",
        "sector": "PC",
        "email": "mariana.conteo@gestiondeposito.com",
    },
]


def seed_usuarios() -> None:
    conn = pyodbc.connect(get_connection_string())
    cur = conn.cursor()
    try:
        for u in INITIAL_USERS:
            pw_hash = hash_password(u["password"])
            cur.execute("SELECT id_usuario FROM dbo.usuario WHERE username = ?", (u["username"],))
            row = cur.fetchone()
            if row:
                cur.execute(
                    """
                    UPDATE dbo.usuario
                    SET password_hash = ?,
                        nombre = ?,
                        apellido = ?,
                        rol = ?,
                        sector = ?,
                        email = ?,
                        activo = 1
                    WHERE id_usuario = ?
                    """,
                    (pw_hash, u["nombre"], u["apellido"], u["rol"], u["sector"], u["email"], row[0]),
                )
                print(f"Usuario actualizado: {u['username']} ({u['rol']})")
            else:
                cur.execute(
                    """
                    INSERT INTO dbo.usuario (username, password_hash, nombre, apellido, rol, sector, email, activo, fecha_creacion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, SYSUTCDATETIME())
                    """,
                    (u["username"], pw_hash, u["nombre"], u["apellido"], u["rol"], u["sector"], u["email"]),
                )
                print(f"Usuario creado: {u['username']} ({u['rol']})")
        conn.commit()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed_usuarios()
