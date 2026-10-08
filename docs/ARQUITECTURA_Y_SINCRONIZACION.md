# Estructura de la Arquitectura y Manual Operativo de Sincronización

## 1. Topología de Red y Aislamiento Físico

```
========================= ENTORNO PLANTA (INTERNO AISLADO) =========================
  [Dispositivos / PCs Planta]
              |
              v (HTTP local en LAN)
  [Frontend Interno (React/Vite)] -> Puerto 5173 (Hosteado vía PM2)
              |
              v (HTTP local en LAN)
  [Backend Planta (FastAPI)] ------> Puerto 8000 (Hosteado vía PM2)
         |               |
         v               | (HTTPS Saliente / Outbound Only - Puerto 443)
  [SQL Server Corp]      | (CERO puertos de entrada abiertos hacia Internet)
  (Base de datos local)  |
                         |
========================= CANAL SEGURO EN INTERNET =================================
                         |
                         | Push de Pedidos nuevos (POST HTTPS)
                         | & Pull periódico de Estados/Remitos (GET cada 60s)
                         v
========================= ENTORNO NODO CL2 (TERCERO EXTERNO) =======================
                  [Base Externa CL2 (Supabase / PostgreSQL)]
                  - RLS habilitado (Row Level Security)
                  - Tablas acotadas: pedidos_cl2, stock_cl2, remitos_cl2
                  - Autenticación JWT integrada
                             ^
                             | (HTTPS API)
                             |
                  [Frontend CL2 (Vercel SPA)]
                  - Dominio público: https://gestion-deposito-nine.vercel.app
                  - Acceso exclusivo para operarios del tercero
====================================================================================
```

---

## 2. Flujo Operativo en Cada Escenario

### Escenario A: Usuario de Planta crea un Pedido (Planta -> CL2)
1. **Acción:** El usuario de planta entra al sistema interno (`http://IP_SERVIDOR:5173/nuevo-pedido`) y confirma el pedido.
2. **Impacto Local:** El backend de FastAPI guarda el pedido en tu **SQL Server** de planta dentro de una transacción.
3. **Replicación Externa:** Inmediatamente, `Cl2SyncService` dispara una llamada HTTPS saliente (`POST`) a la API de Supabase con el pedido y sus renglones.
4. **Visibilidad en CL2:** El tercero abre su pantalla en Vercel y el pedido ya figura en su listado para preparación.
5. **Tolerancia a Fallos:** Si la conexión a Internet de planta se interrumpe, el evento se guarda en la tabla local `SyncOutbox` de SQL Server para enviarse apenas vuelva la conectividad.

---

### Escenario B: Operario de CL2 prepara y remite un Pedido (CL2 -> Planta)
1. **Acción:** El operario del tercero ingresa en Vercel, marca el pedido como `en_preparacion` o `completo` y emite el remito.
2. **Impacto Externo:** La base de Supabase actualiza el estado del pedido y guarda el nombre del operador que lo preparó.
3. **Sondeo Unidireccional (Outbound Polling):**
   - Dado que tu servidor de planta tiene los puertos de entrada cerrados al exterior, **nadie desde Internet puede tocar tu servidor**.
   - En su lugar, el worker en segundo plano de FastAPI (`_cl2_sync_polling_loop`) realiza una consulta periódica cada 60 segundos hacia Supabase (`GET /rest/v1/pedidos_cl2`).
4. **Impacto en Planta:**
   - FastAPI detecta el cambio de estado (`en_preparacion` o `completo`) y la fecha de despacho.
   - Ejecuta un `UPDATE` en tu SQL Server local.
   - En planta, la pantalla de pedidos e historial se actualiza mostrando el estado real y qué operador de CL2 lo procesó.

---

### Escenario C: Falla o Corte de Conexión a Internet
- **En Planta:** La operación interna sigue funcionando al 100% de manera autónoma contra el SQL Server local. Nada se bloquea.
- **En CL2:** El tercero sigue viendo y operando los pedidos que ya tenía descargados en Supabase.
- **Reanudación:** Al restablecerse el enlace de Internet, el bucle de sincronización concilia automáticamente las diferencias acumuladas sin intervención manual.

---

## 3. Matriz de Configuración por Entorno

| Variable | Servidor de Planta (`backend/.env`) | Servidor de Planta (`frontend/.env`) | Vercel (Frontend CL2) |
| :--- | :--- | :--- | :--- |
| `DB_SERVER` | `.\SQLEXPRESS` (o Instancia local) | *No aplica* | *No aplica* |
| `DB_NAME` | `GestionDeposito` | *No aplica* | *No aplica* |
| `VITE_API_URL` | *No aplica* | `http://IP_SERVIDOR:8000` | `http://IP_BACKEND:8000` o URL nodo |
| `CL2_SYNC_ENABLED` | `true` | *No aplica* | *No aplica* |
| `CL2_API_URL` | `https://<id-proyecto>.supabase.co` | *No aplica* | *No aplica* |
| `CL2_API_KEY` | Clave secreta `service_role` | *No aplica* | *No aplica* |
| `CORS_ORIGINS` | IPs de planta y URL de Vercel | *No aplica* | *No aplica* |

---

## 4. Guía de Ejecución y Monitoreo con PM2 en Planta

### Iniciar los servicios:
```bash
# Desde la raíz del repositorio en el servidor de Planta
pm2 start ecosystem.config.js
pm2 save
```

### Comandos de control:
- **Verificar que ambos procesos estén en línea:**
  ```bash
  pm2 status
  ```
- **Ver la sincronización en vivo (logs de despacho y sondeo):**
  ```bash
  pm2 logs gestion-deposito-backend
  ```
- **Reiniciar servicios ante actualizaciones:**
  ```bash
  pm2 restart gestion-deposito-backend
  pm2 restart gestion-deposito-frontend
  ```
