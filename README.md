# Sistema Interno de Gestión de Pedidos y Stock

Sistema web interno para digitalizar y centralizar la gestión de pedidos de materiales, control de stock, conteo físico y seguimiento de entregas.

El objetivo principal es reemplazar procesos manuales basados en correos electrónicos, planillas y registros en papel, permitiendo una mayor trazabilidad y reduciendo la carga de datos duplicada.

---

## Funcionalidades

### Gestión de materiales

- Alta, baja y modificación de materiales.
- Gestión de códigos y nombres.
- Gestión de recetas (BOM).
- Carga inicial de stock.

### Conteo en planta

- Conteo físico de materiales desde un dispositivo.
- Comparación entre stock teórico y stock real.
- Visualización de desvíos.
- Arrastre del stock día a día.
- Generación de cantidades sugeridas para realizar pedidos.

### Pedidos

- Creación de pedidos manuales.
- Creación de pedidos a partir de sugerencias del conteo.
- Edición de cantidades antes de confirmar.
- Seguimiento del estado de cada pedido.
- Preparación y confirmación de pedidos completos o parciales.

### Stock

- Stock teórico.
- Stock físico.
- Movimientos de stock.
- Descuento automático según cantidades entregadas.
- Histórico de movimientos.

### Rundown

- Importación de información desde Excel.
- Visualización del rundown dentro del sistema.
- Cálculo del consumo estimado mediante BOM y producción.
- Cálculo automático de desvíos.
- Sugerencia de cantidades a pedir.

### Ingresos y documentación

- Registro de ingresos de materiales.
- Carga de facturas y comprobantes.
- Generación automática de remitos internos en PDF.
- Historial de pedidos, ingresos y movimientos.

---

# Arquitectura

El proyecto utiliza un **monorepo**, manteniendo frontend y backend separados dentro del mismo repositorio.

```text
gestion-pedidos-stock/
│
├── frontend/              # React + TypeScript + Tailwind
│
├── backend/               # Python + FastAPI
│
├── docs/                  # Documentación
│
├── .env.example
├── .gitignore
└── README.md
```

## Frontend

Tecnologías utilizadas:

- React
- TypeScript
- Tailwind CSS

El frontend es responsable de la interfaz de usuario y consume la API desarrollada con FastAPI.

La aplicación está diseñada para funcionar correctamente tanto en computadoras como en dispositivos móviles utilizados durante el conteo físico en planta.

## Backend

Tecnologías utilizadas:

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL

El backend concentra toda la lógica de negocio del sistema:

- Gestión de pedidos.
- Cálculo de arrastre de stock.
- Procesamiento del rundown.
- Importación de archivos Excel.
- Generación de sugerencias de pedido.
- Gestión de ingresos y remitos.

## Base de datos

SQL almacena toda la información operativa:

- Materiales.
- Recetas/BOM.
- Usuarios.
- Stock.
- Pedidos.
- Detalle de pedidos.
- Ingresos.
- Remitos.
- Movimientos de stock.
- Historial de operaciones.

---

# Rundown

El sistema incorpora la información proveniente del Excel de rundown y la utiliza como base para los cálculos operativos.

La pantalla muestra una fila por material con las siguientes columnas:

- Código.
- Nombre.
- Stock inicial.
- Conteo físico.
- Desvío.
- Consumo estimado.
- Producción del día siguiente.
- Cantidad sugerida a pedir.

El cálculo de la sugerencia se realiza automáticamente en el backend utilizando la producción, la receta de cada producto y el stock disponible.

---

# Roles de usuario

El sistema contempla tres perfiles principales.

### Sector solicitante

Puede:

- Realizar pedidos.
- Consultar estados.
- Revisar sugerencias.
- Visualizar el historial correspondiente.

### Depósito

Puede:

- Visualizar pedidos pendientes.
- Preparar materiales.
- Confirmar entregas parciales o completas.
- Registrar movimientos de stock.

### Administrador

Puede:

- Gestionar materiales.
- Administrar usuarios.
- Configurar datos iniciales.
- Importar información desde Excel.
- Consultar el historial completo del sistema.

---

# Estructura del Backend

```text
backend/
└── app/
    ├── api/
    │   └── routes/
    │       ├── materials.py
    │       ├── orders.py
    │       ├── stock.py
    │       ├── counting.py
    │       ├── rundown.py
    │       └── imports.py
    │
    ├── core/
    │   ├── config.py
    │   └── security.py
    │
    ├── models/
    │
    ├── schemas/
    │
    ├── repositories/
    │
    ├── services/
    │
    ├── calculations/
    │
    └── main.py
```

La arquitectura busca separar claramente las responsabilidades entre:

- **Routes:** endpoints de la API.
- **Schemas:** validación de datos con Pydantic.
- **Models:** entidades de la base de datos.
- **Repositories:** acceso a datos.
- **Services:** reglas de negocio.
- **Calculations:** lógica específica de cálculo de stock y sugerencias.

---

# Instalación

Ingresar a la carpeta del frontend:

```bash
cd frontend
```

Instalar dependencias:

```bash
npm install
```

Ejecutar el proyecto:

```bash
npm run dev
```

La aplicación estará disponible en:

```text
http://localhost:5173
```

---

## Backend

Ingresar a la carpeta:

```bash
cd backend
```

Crear el entorno virtual:

```bash
python -m venv venv
```

Activarlo.

### Windows

```bash
venv\Scripts\activate
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

Ejecutar el servidor:

```bash
uvicorn app.main:app --reload
```

La API estará disponible en:

```text
http://localhost:8000
```

La documentación automática de FastAPI estará disponible en:

```text
http://localhost:8000/docs
```

# Roadmap

El desarrollo se realizará de forma progresiva.

### MVP

- [ ] Gestión de materiales.
- [ ] Gestión de recetas/BOM.
- [ ] Base de datos PostgreSQL.
- [ ] Importación del rundown desde Excel.
- [ ] Producción estimada y real.
- [ ] Conteo físico.
- [ ] Arrastre de stock.
- [ ] Cálculo de desvíos.
- [ ] Pedido manual.
- [ ] Pedido sugerido.
- [ ] Visualización de pedidos en depósito.

### Segunda etapa

- [ ] Preparación de pedidos.
- [ ] Confirmación parcial o completa.
- [ ] Movimientos automáticos de stock.
- [ ] Generación de remitos PDF.
- [ ] Registro de ingresos.
- [ ] Carga de comprobantes.
- [ ] Historial completo.

### Futuras mejoras

- [ ] Integración con sistemas externos.
- [ ] OCR de remitos y comprobantes.
- [ ] Métricas de proveedores.
- [ ] Sugerencias basadas en datos históricos.
- [ ] Mejoras de analítica y reportes.

---

# Objetivo del proyecto

Centralizar toda la operación relacionada con pedidos y stock en una única aplicación web, eliminando la duplicación de datos y mejorando la trazabilidad de cada proceso.

El sistema permitirá conocer en todo momento:

- Qué materiales fueron solicitados.
- Quién realizó cada pedido.
- Qué cantidades fueron preparadas.
- Qué se entregó efectivamente.
- Cómo evolucionó el stock.
- Qué diferencias existen entre el stock teórico y el conteo físico.

De esta manera se busca reducir errores operativos, ahorrar tiempo administrativo y disponer de un historial completo de todas las operaciones realizadas.

---

# Licencia

Proyecto de uso interno.