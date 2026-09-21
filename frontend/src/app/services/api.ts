const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface BomVersionItem {
  id_version: number;
  nombre_archivo: string;
  fecha_importacion: string;
  total_lineas: number;
  es_vigente: boolean;
  observacion: string | null;
}

export interface SetComponenteItem {
  id_set_componente: number;
  sector: string | null;
  sd: string | null;
  codigo_tasa: string;
  codigo_sap_padre: string;
  id_material_hijo: string;
  descripcion_hijo: string | null;
  cantidad: number;
  unidad: string;
  activo: boolean;
}

export interface SetComponenteInput {
  sector?: string;
  sd?: string;
  codigo_tasa: string;
  codigo_sap_padre: string;
  id_material_hijo: string;
  cantidad: number;
  unidad?: string;
}

export interface DemandItemApi {
  id: string;
  part_number: string;
  tasa_code: string;
  description: string;
  dock: string;
  box_type: string;
  qty_per_box: number;
  daily_values: Record<string, number>;
  tentative_values?: Record<string, number>;
  tentative_total: number;
  total: number;
  status: string;
}

export interface SupplySummaryApi {
  periodo: string;
  total_demanda: number;
  piezas_validadas: number;
  total_piezas: number;
  columnas_diarias?: string[];
  columnas_tentativas?: string[];
  items: DemandItemApi[];
}

export interface SupplyConsolidateResultApi {
  total_items: number;
  total_unidades: number;
  columnas_diarias: string[];
  columnas_tentativas: string[];
  items: DemandItemApi[];
  mensaje: string;
}

export async function getBomVersions(): Promise<BomVersionItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/bom/versiones`);
  if (!res.ok) {
    throw new Error(`Error al obtener versiones de BOM (${res.status})`);
  }
  return res.json();
}

export async function getSetComponentes(params?: {
  sector?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SetComponenteItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.sector && params.sector !== "todos") query.set("sector", params.sector);
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE_URL}/api/bom/relaciones?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Error al obtener relaciones de BOM (${res.status})`);
  }
  return res.json();
}

export async function createSetComponente(
  data: SetComponenteInput
): Promise<SetComponenteItem> {
  const res = await fetch(`${API_BASE_URL}/api/bom/relaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear relación");
  }
  return res.json();
}

export async function updateSetComponente(
  id: number,
  data: Partial<SetComponenteInput> & { activo?: boolean }
): Promise<SetComponenteItem> {
  const res = await fetch(`${API_BASE_URL}/api/bom/relaciones/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar relación");
  }
  return res.json();
}

export async function toggleSetComponente(
  id: number
): Promise<{ id_set_componente: number; activo: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/bom/relaciones/${id}/toggle`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cambiar estado de relación");
  }
  return res.json();
}

export async function uploadBomFile(file: File): Promise<{
  id_version: number;
  nombre_archivo: string;
  total_lineas_procesadas: number;
  nuevos_materiales_registrados: number;
  total_relaciones_creadas: number;
  mensaje: string;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/bom/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al importar archivo BOM");
  }
  return res.json();
}

export async function getSupplySummary(): Promise<SupplySummaryApi> {
  const res = await fetch(`${API_BASE_URL}/api/suministro/resumen`);
  if (!res.ok) {
    throw new Error(`Error al obtener resumen de suministro (${res.status})`);
  }
  return res.json();
}

export async function consolidateSupply(files: {
  f1Files?: File[];
  f2Files?: File[];
}): Promise<SupplyConsolidateResultApi> {
  const formData = new FormData();
  if (files.f1Files) {
    for (const f of files.f1Files) {
      formData.append("files_f1", f);
    }
  }
  if (files.f2Files) {
    for (const f of files.f2Files) {
      formData.append("files_f2", f);
    }
  }

  const res = await fetch(`${API_BASE_URL}/api/suministro/consolidar`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al consolidar orden de suministro");
  }
  return res.json();
}

export async function downloadExcelConsolidado(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/suministro/exportar/excel`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al descargar el archivo Excel consolidado");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = "Consolidado_Demanda_BOM_Consumo.xlsx";
  const match = disposition.match(/filename\*?=(?:utf-8'')?([^;]+)/i);
  if (match && match[1]) {
    filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadSapPirTxt(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/suministro/exportar/sap-pir`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al descargar archivo SAP PIR");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  let filename = "Demanda_SAP_PIR.txt";
  const match = disposition.match(/filename\*?=(?:utf-8'')?([^;]+)/i);
  if (match && match[1]) {
    filename = decodeURIComponent(match[1].replace(/['"]/g, ""));
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface RundownDayCell {
  fecha: string;
  dia_nombre: string;
  produccion_vehiculos: number;
  uso: number;
  plan_maritimo: number;
  pedidos_aereos: number;
  entregas_locales: number;
  ajuste_scrap: number;
  stock_final: number;
  dias_cobertura: number;
  alerta_quiebre: boolean;
  tiene_ajuste?: boolean;
  desvio_ajuste?: number;
}

export interface RundownMaterialGrid {
  id_parametro: number;
  id_material: string;
  descripcion: string;
  categoria_cabina: string | null;
  unidad: string;
  lote_mts: number | null;
  scrap_porcentaje: number;
  stock_inicial: number;
  stock_inicial_planta: number;
  stock_inicial_total: number;
  dias: RundownDayCell[];
  total_uso: number;
  total_ingresos: number;
  id_proveedor?: number;
  nombre_proveedor?: string;
}

export interface RundownPeriodoItem {
  periodo: string;
  anio: number;
  mes: number;
  label: string;
  es_firme: boolean;
  es_proyectado_manual?: boolean;
  periodo_copia?: string | null;
  total_volumen?: number;
}

export interface RundownSupplierReport {
  id_proveedor: number;
  codigo_proveedor: string;
  nombre_proveedor: string;
  fecha_desde: string;
  fecha_hasta: string;
  alcance: "total" | "planta";
  periodo_actual: string;
  es_mes_firme: boolean;
  dias_laborales_mes: number;
  meses_disponibles: RundownPeriodoItem[];
  columnas_fechas: string[];
  materiales: RundownMaterialGrid[];
  dias_alerta_rojo?: number;
  dias_alerta_amarillo?: number;
}

export interface RundownTransitoInput {
  id_proveedor: number;
  id_material: string;
  fecha_eta: string;
  tipo_via: "Maritimo" | "Aereo" | "Local" | "AjusteScrap";
  po_numero?: string;
  factura_numero?: string;
  cantidad: number;
  observacion?: string;
}

export interface RundownIngresoDiaInput {
  id_proveedor: number;
  id_material: string;
  fecha_eta: string;
  tipo_via: "Maritimo" | "Aereo" | "Local" | "AjusteScrap";
  cantidad: number;
  po_numero?: string;
  factura_numero?: string;
  observacion?: string;
  fecha_origen?: string;
}

export async function getSupplierRundown(
  identifier: string,
  fechaDesde?: string,
  fechaHasta?: string,
  alcance: "total" | "planta" = "total",
  periodo?: string,
  idSeccion?: number
): Promise<RundownSupplierReport> {
  const query = new URLSearchParams();
  if (fechaDesde) query.set("fecha_desde", fechaDesde);
  if (fechaHasta) query.set("fecha_hasta", fechaHasta);
  query.set("alcance", alcance);
  if (periodo) query.set("periodo", periodo);
  if (idSeccion) query.set("id_seccion", String(idSeccion));

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/api/rundown/proveedor/${identifier}${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cargar el rundown del proveedor");
  }
  return res.json();
}

export async function createRundownTransito(
  data: RundownTransitoInput
): Promise<{ id_transito: number; mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/transito`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al registrar arribo en tránsito");
  }
  return res.json();
}

export async function upsertRundownIngresoDia(
  data: RundownIngresoDiaInput
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/ingreso-dia`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar ingreso del día");
  }
  return res.json();
}

export async function deleteRundownTransito(
  idTransito: number
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/transito/${idTransito}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al eliminar arribo en tránsito");
  }
  return res.json();
}

export async function updateRundownStockInicial(
  idParametro: number,
  stockInicial: number,
  tipoStock: "total" | "planta" = "total"
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/stock-inicial`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_parametro: idParametro, stock_inicial: stockInicial, tipo_stock: tipoStock }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar stock inicial");
  }
  return res.json();
}

export interface RundownStockAjusteInput {
  id_parametro: number;
  id_proveedor: number;
  id_material: string;
  fecha: string;
  tipo_stock: "total" | "planta";
  stock_ajustado: number;
  observacion?: string;
}

export async function updateRundownStockAjuste(
  data: RundownStockAjusteInput
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/stock-ajuste`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar stock para la fecha seleccionada");
  }
  return res.json();
}

export async function deleteRundownStockAjuste(
  idParametro: number,
  fecha: string,
  tipoStock: string = "total"
): Promise<{ mensaje: string }> {
  const query = new URLSearchParams({
    id_parametro: String(idParametro),
    fecha,
    tipo_stock: tipoStock,
  });
  const res = await fetch(`${API_BASE_URL}/api/rundown/stock-ajuste?${query.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al eliminar ajuste de stock");
  }
  return res.json();
}

export async function updateRundownScrap(
  idParametro: number,
  scrapPorcentaje: number
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/scrap`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_parametro: idParametro, scrap_porcentaje: scrapPorcentaje }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar porcentaje de scrap");
  }
  return res.json();
}

export interface RundownCalendarioDia {
  fecha: string;
  dia: number;
  dia_semana: number;
  dia_nombre: string;
  es_laboral: boolean;
  observacion?: string | null;
}

export interface RundownCalendarioMesOut {
  anio: number;
  mes: number;
  mes_nombre: string;
  es_mes_firme: boolean;
  dias_laborales_count: number;
  volumen_total_planificado: number;
  promedio_diario_estimado: number;
  dias: RundownCalendarioDia[];
}

export interface RundownCalendarioDiaUpdate {
  fecha: string;
  es_laboral: boolean;
  observacion?: string | null;
}

export interface RundownCalendarioMesSave {
  anio: number;
  mes: number;
  dias: RundownCalendarioDiaUpdate[];
}

export async function getRundownCalendarioMes(
  anio: number,
  mes: number
): Promise<RundownCalendarioMesOut> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/calendario?anio=${anio}&mes=${mes}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cargar calendario mensual");
  }
  return res.json();
}

export async function saveRundownCalendarioMes(
  data: RundownCalendarioMesSave
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/calendario`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al guardar calendario productivo");
  }
  return res.json();
}

export interface RundownProveedorItem {
  id_proveedor: number;
  codigo_proveedor: string;
  nombre: string;
  id_seccion: number | null;
  activo: boolean;
  tiene_parametros: boolean;
  dias_alerta_rojo?: number;
  dias_alerta_amarillo?: number;
}

export interface RundownSeccionItem {
  id_seccion: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  proveedores: RundownProveedorItem[];
}

export interface RundownSeccionInput {
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export interface RundownProveedorInput {
  codigo_proveedor: string;
  nombre: string;
  id_seccion?: number;
  pais?: string;
  dias_alerta_rojo?: number;
  dias_alerta_amarillo?: number;
}

export async function getRundownSecciones(): Promise<RundownSeccionItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/secciones`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cargar secciones de rundown");
  }
  return res.json();
}

export async function createRundownSeccion(
  data: RundownSeccionInput
): Promise<{ id_seccion: number; mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/secciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear sección de rundown");
  }
  return res.json();
}

export async function createRundownProveedor(
  data: RundownProveedorInput
): Promise<{ id_proveedor: number; mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/proveedores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al registrar proveedor");
  }
  return res.json();
}

export async function updateRundownProveedor(
  idProveedor: number,
  data: {
    nombre?: string;
    id_seccion?: number | null;
    activo?: boolean;
    dias_alerta_rojo?: number;
    dias_alerta_amarillo?: number;
  }
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/proveedores/${idProveedor}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar proveedor");
  }
  return res.json();
}

export interface MaterialCatalogoItem {
  id_material: string;
  nombre: string;
  unidad?: string;
  categoria?: string | null;
}

export interface RundownParametroMaterialItem {
  id_parametro: number;
  id_proveedor: number;
  id_material: string;
  descripcion: string;
  unidad: string;
  lote_mts?: number | null;
  scrap_porcentaje: number;
  factor_conversion: number;
  categoria_cabina?: string | null;
  stock_inicial_planta: number;
  stock_inicial_total: number;
  cant_productos: number;
  activo: boolean;
}

export interface RundownParametroMaterialCreate {
  id_material: string;
  descripcion?: string;
  unidad?: string;
  lote_mts?: number;
  scrap_porcentaje?: number;
  factor_conversion?: number;
  categoria_cabina?: string;
  stock_inicial_planta?: number;
  stock_inicial_total?: number;
}

export async function searchMaterialesCatalogo(q: string = ""): Promise<MaterialCatalogoItem[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/rundown/materiales-catalogo${qs}`);
  if (!res.ok) throw new Error("Error al buscar materiales en catálogo");
  return res.json();
}

export async function getProveedorMateriales(idProveedor: number): Promise<RundownParametroMaterialItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/proveedores/${idProveedor}/materiales`);
  if (!res.ok) throw new Error("Error al cargar materiales del proveedor");
  return res.json();
}

export async function addProveedorMaterial(
  idProveedor: number,
  data: RundownParametroMaterialCreate
): Promise<{ id_parametro: number; mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/proveedores/${idProveedor}/materiales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al agregar material al rundown");
  }
  return res.json();
}

export async function deleteProveedorMaterial(
  idProveedor: number,
  idParametro: number
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/proveedores/${idProveedor}/materiales/${idParametro}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al remover material del rundown");
  }
  return res.json();
}

export interface RundownPeriodoProyeccionItem {
  id_proyeccion: number;
  anio: number;
  mes: number;
  periodo: string;
  periodo_copia: string;
  label: string;
  observacion?: string | null;
  es_oficial: boolean;
  activo: boolean;
}

export interface RundownPeriodoProyeccionCreate {
  anio: number;
  mes: number;
  periodo_copia: string;
  observacion?: string;
}

export async function getPeriodosProyeccion(): Promise<RundownPeriodoProyeccionItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/periodos-proyeccion`);
  if (!res.ok) throw new Error("Error al cargar períodos de proyección");
  return res.json();
}

export async function createPeriodoProyeccion(
  data: RundownPeriodoProyeccionCreate
): Promise<{ id_proyeccion: number; mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/periodos-proyeccion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al configurar período de proyección");
  }
  return res.json();
}

export async function deletePeriodoProyeccion(
  idProyeccion: number
): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/periodos-proyeccion/${idProyeccion}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al eliminar período de proyección");
  }
  return res.json();
}

export interface PlanSemanalDiaHeader {
  nombre: string;
  fecha: string;
  total: number;
}

export interface PlanSemanalFila {
  sd: string;
  id_producto?: string | null;
  descripcion?: string | null;
  cantidades: Record<string, number>;
  total_semana: number;
  mapeado: boolean;
}

export interface PlanSemanalPreviewOut {
  id_seccion: number;
  seccion_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: PlanSemanalDiaHeader[];
  filas: PlanSemanalFila[];
  totales_dia: Record<string, number>;
  total_general: number;
  advertencias: string[];
}

export interface PlanSemanalItemConfirm {
  sd: string;
  id_producto: string;
  fecha: string;
  cantidad: number;
}

export interface PlanSemanalConfirmRequest {
  fecha_inicio: string;
  fecha_fin: string;
  items: PlanSemanalItemConfirm[];
}

export interface PlanSemanalConfirmOut {
  success: boolean;
  registros_plan_linea: number;
  registros_produccion_planificada: number;
  mensaje: string;
}

export async function previewPlanSemanal(
  idSeccion: number,
  file: File,
  overrideFechaInicio?: string
): Promise<PlanSemanalPreviewOut> {
  const formData = new FormData();
  formData.append("file", file);
  if (overrideFechaInicio) {
    formData.append("override_fecha_inicio", overrideFechaInicio);
  }

  const res = await fetch(`${API_BASE_URL}/api/rundown/secciones/${idSeccion}/plan-semanal/previsualizar`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al previsualizar el plan semanal");
  }
  return res.json();
}

export async function confirmPlanSemanal(
  idSeccion: number,
  payload: PlanSemanalConfirmRequest
): Promise<PlanSemanalConfirmOut> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/secciones/${idSeccion}/plan-semanal/confirmar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al confirmar el plan semanal");
  }
  return res.json();
}



