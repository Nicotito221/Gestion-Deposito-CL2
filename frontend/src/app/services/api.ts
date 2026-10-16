const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8002";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isLocalHostname =
  typeof window !== "undefined" &&
  Boolean(window.location.hostname.match(/^(localhost|127\.0\.0\.1|172\.|192\.168\.|10\.)/));

export const IS_SUPABASE_ACTIVE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !isLocalHostname);

export interface BomVersionItem {
  id_version: number;
  nombre_archivo: string;
  fecha_importacion: string;
  total_lineas: number;
  es_vigente: boolean;
  observacion: string | null;
}

export interface BomEstructuraItem {
  id_bom: number;
  id_version: number;
  nivel: number;
  id_producto_raiz: string;
  id_padre: string;
  id_hijo: string;
  descripcion_hijo: string | null;
  cantidad: number;
  unidad: string;
  orden: number;
}

export interface BomEstructuraResponse {
  id_version: number | null;
  nombre_archivo: string | null;
  total: number;
  items: BomEstructuraItem[];
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
  columnas_fechas_map?: Record<string, string>;
  items: DemandItemApi[];
}

export interface SupplyConsolidateResultApi {
  total_items: number;
  total_unidades: number;
  columnas_diarias: string[];
  columnas_tentativas: string[];
  columnas_fechas_map?: Record<string, string>;
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

export async function getBomEstructuraActiva(params?: {
  id_version?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<BomEstructuraResponse> {
  const query = new URLSearchParams();
  if (params?.id_version) query.set("id_version", String(params.id_version));
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE_URL}/api/bom/estructura-activa?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Error al obtener estructura de BOM (${res.status})`);
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

export async function updateSupplyDailyProduction(data: {
  id_producto: string;
  fecha: string;
  cantidad: number;
}): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/suministro/produccion-diaria`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar valor diario");
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

export async function downloadSapPirTxt(fechaCorte?: string): Promise<void> {
  const q = fechaCorte ? `?fecha_corte=${encodeURIComponent(fechaCorte)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/suministro/exportar/sap-pir${q}`);
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
  maritimo_po?: string | null;
  maritimo_factura?: string | null;
  maritimo_obs?: string | null;
  maritimo_estado?: "planificado" | "confirmado" | null;
  pedidos_aereos: number;
  aereo_po?: string | null;
  aereo_factura?: string | null;
  aereo_obs?: string | null;
  aereo_estado?: "planificado" | "confirmado" | null;
  entregas_locales: number;
  local_po?: string | null;
  local_factura?: string | null;
  local_obs?: string | null;
  local_estado?: "planificado" | "confirmado" | null;
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
  tipo_empaque?: string;
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
  es_finalizado?: boolean;
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
  deposito_en_planta?: boolean;
  doh_sugerido_planta?: number;
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
  estado?: "planificado" | "confirmado";
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
  estado?: "planificado" | "confirmado";
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
  stock_planta?: number;
  stock_cl2?: number;
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
  factor?: number;
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
  deposito_en_planta?: boolean;
  doh_sugerido_planta?: number;
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
  deposito_en_planta?: boolean;
  doh_sugerido_planta?: number;
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
    deposito_en_planta?: boolean;
    doh_sugerido_planta?: number;
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
  tipo_empaque?: string;
  tamanio_lote?: number;
  bultos_por_pallet?: number | null;
  unidad_por_bulto?: number | null;
  id_proveedor?: number | null;
  proveedor_nombre?: string | null;
  stock_planta?: number;
  stock_cl2?: number;
  stock_total?: number;
  deposito_en_planta?: boolean;
}

export interface RundownParametroMaterialItem {
  id_parametro: number;
  id_proveedor: number;
  id_material: string;
  descripcion: string;
  unidad: string;
  lote_mts?: number | null;
  tipo_empaque?: string;
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
  tipo_empaque?: string;
  scrap_porcentaje?: number;
  factor_conversion?: number;
  categoria_cabina?: string;
  stock_inicial_planta?: number;
  stock_inicial_total?: number;
}

export interface RundownLoteMaterialUpdate {
  id_parametro?: number | null;
  id_material?: string | null;
  lote_mts: number | null;
  tipo_empaque: string;
}

export async function updateLoteMaterial(data: RundownLoteMaterialUpdate): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/materiales/lote`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al actualizar lote del material");
  return res.json();
}


export async function searchMaterialesCatalogo(q: string = ""): Promise<MaterialCatalogoItem[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/rundown/materiales-catalogo${qs}`);
  if (!res.ok) throw new Error("Error al buscar materiales en catálogo");
  return res.json();
}

export async function getMaterialCatalogoInfo(idMaterial: string): Promise<MaterialCatalogoItem | null> {
  const res = await fetch(`${API_BASE_URL}/api/rundown/materiales-catalogo/${encodeURIComponent(idMaterial.trim())}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Error al obtener información del material");
  }
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

export interface StockMaterialItem {
  id_material: string;
  nombre: string;
  unidad: string;
  categoria?: string | null;
  stock_actual: number;
  stock_planta: number;
  stock_cl2: number;
  stock_total: number;
  id_proveedor?: number | null;
  nombre_proveedor?: string | null;
  deposito_en_planta: boolean;
  fecha_actualizacion?: string | null;
  id_parametro?: number | null;
  lote_mts?: number | null;
  unidad_por_bulto?: number | null;
  bultos_por_pallet?: number | null;
  tipo_empaque?: string | null;
}

export interface StockListResponse {
  items: StockMaterialItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StockAjusteInput {
  fecha?: string;
  nuevo_stock?: number;
  nuevo_stock_planta?: number;
  nuevo_stock_cl2?: number;
  observacion?: string;
  id_usuario?: number;
}

export interface StockAjusteResponse {
  id_material: string;
  stock_anterior: number;
  stock_nuevo: number;
  stock_planta?: number;
  stock_cl2?: number;
  stock_total?: number;
  mensaje: string;
}

export async function getStockDeposito(params?: {
  search?: string;
  id_proveedor?: number;
  solo_con_stock?: boolean;
  tipo_almacen?: string;
  page?: number;
  page_size?: number;
}): Promise<StockListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.id_proveedor) query.append("id_proveedor", String(params.id_proveedor));
  if (params?.solo_con_stock) query.append("solo_con_stock", "true");
  if (params?.tipo_almacen) query.append("tipo_almacen", params.tipo_almacen);
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/stock/deposito${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener stock");
  }
  return res.json();
}

export async function updateStockDeposito(
  idMaterial: string,
  payload: StockAjusteInput
): Promise<StockAjusteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/stock/deposito/${encodeURIComponent(idMaterial)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar stock");
  }
  return res.json();
}

export interface StockMovimientoItem {
  id_movimiento: number;
  id_material: string;
  nombre_material?: string | null;
  unidad?: string | null;
  tipo: string;
  cantidad: number;
  stock_anterior: number;
  stock_posterior: number;
  id_usuario: number;
  nombre_usuario?: string | null;
  fecha: string;
  observacion?: string | null;
  id_pedido?: number | null;
  id_remito?: string | null;
}

export interface StockMovimientosResponse {
  items: StockMovimientoItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getStockMovimientos(params?: {
  search?: string;
  tipo?: string;
  page?: number;
  page_size?: number;
}): Promise<StockMovimientosResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.tipo) query.append("tipo", params.tipo);
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/stock/movimientos${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener movimientos de stock");
  }
  return res.json();
}

export interface ConteoMaterialSearchItem {
  id_material: string;
  nombre: string;
  unidad: string;
  id_proveedor?: number | null;
  nombre_proveedor?: string | null;
  deposito_en_planta: boolean;
  stock_teorico: number;
  tipo_empaque?: string;
  lote_pallet?: number;
  bultos_por_pallet?: number;
}

export interface MaterialConteoItemInput {
  id_material: string;
  stock_contado: number;
  observacion?: string;
}

export interface ConteoCreateRequest {
  fecha_impacto?: string;
  observacion?: string;
  items: MaterialConteoItemInput[];
}

export interface MaterialConteoItemResponse {
  id_conteo: number;
  id_material: string;
  nombre_material?: string | null;
  unidad?: string | null;
  nombre_proveedor?: string | null;
  stock_teorico: number;
  stock_contado: number;
  desvio: number;
  observacion?: string | null;
}

export interface ConteoResponse {
  id_conteo: number;
  tipo: string;
  id_usuario: number;
  nombre_usuario?: string | null;
  estado: string;
  fecha_impacto: string;
  fecha_inicio?: string | null;
  fecha_finalizacion?: string | null;
  observacion?: string | null;
  total_items: number;
  items: MaterialConteoItemResponse[];
}

export interface ConteoHistoricoItem {
  id_conteo: number;
  tipo: string;
  id_usuario: number;
  nombre_usuario?: string | null;
  estado: string;
  fecha_impacto?: string | null;
  fecha_inicio?: string | null;
  fecha_finalizacion?: string | null;
  observacion?: string | null;
  total_items: number;
  total_desvio: number;
}

export interface ConteoHistoricoResponse {
  items: ConteoHistoricoItem[];
  total: number;
}

export async function searchMaterialesConteo(params?: {
  search?: string;
  id_proveedor?: number;
  target_date?: string;
  limit?: number;
}): Promise<ConteoMaterialSearchItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.id_proveedor) query.append("id_proveedor", String(params.id_proveedor));
  if (params?.target_date) query.append("target_date", params.target_date);
  if (params?.limit) query.append("limit", String(params.limit));

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/conteo/materiales${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al buscar materiales para conteo");
  }
  return res.json();
}

export async function createConteo(data: ConteoCreateRequest): Promise<ConteoResponse> {
  const res = await fetch(`${API_BASE_URL}/api/conteo`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al registrar conteo");
  }
  return res.json();
}

export async function getHistoricoConteos(params?: {
  page?: number;
  page_size?: number;
}): Promise<ConteoHistoricoResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/conteo/historico${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cargar histórico de conteos");
  }
  return res.json();
}

export async function getDetalleConteo(id_conteo: number): Promise<ConteoResponse> {
  const res = await fetch(`${API_BASE_URL}/api/conteo/${id_conteo}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener detalle del conteo");
  }
  return res.json();
}

export interface PedidoExistenteItem {
  id_pedido: number;
  turno?: string;
  cantidad_pedida: number;
  estado: string;
}

export interface SugerenciaMaterialInput {
  id_material: string;
  stock_contado: number;
}

export interface CalcularSugerenciaRequest {
  id_conteo?: number;
  solo_conteo?: boolean;
  materiales?: SugerenciaMaterialInput[];
  fecha_conteo?: string;
  fecha_requerida?: string;
  modalidad_turnos?: "completo" | "2_turnos" | "3_turnos";
  turnos?: string[];
  turno?: string;
  sector?: string;
}

export interface SugerenciaMaterialDetalle {
  id_parametro?: number;
  id_material: string;
  nombre: string;
  unidad: string;
  id_proveedor: number;
  nombre_proveedor: string;
  stock_contado: number;
  stock_cl2?: number;
  en_cl2?: boolean;
  consumo_diario: number;
  consumo_sig?: number;
  doh_sugerido_planta: number;
  stock_objetivo: number;
  stock_proyectado_inicio: number;
  stock_minimo_inicio: number;
  lote_minimo?: number | null;
  tipo_empaque: string;
  tamanio_lote?: number | null;
  unidad_por_bulto?: number | null;
  bultos_por_pallet?: number | null;
  cantidad_pallets_sugerida: number;
  cantidad_bultos_sugerida?: number | null;
  pallets_por_turno: Record<string, number>;
  pedidos_existentes: PedidoExistenteItem[];
  cantidad_ya_pedida_total: number;
  cantidad_sugerida_bruta: number;
  cantidad_sugerida_neta: number;
  desglose_turnos: Record<string, number>;
  pedidos_por_turno: Record<string, number>;
  sugerido_por_turno: Record<string, number>;
}

export interface CalcularSugerenciaResponse {
  fecha_requerida: string;
  modalidad_turnos: string;
  turnos: string[];
  total_materiales: number;
  materiales_a_pedir: number;
  items: SugerenciaMaterialDetalle[];
  turno_sugerido?: string;
}

export interface PedidoItemInput {
  id_material: string;
  cantidad: number;
  comentario?: string;
}

export interface PedidoCreate {
  sector?: string;
  prioridad?: "normal" | "urgente" | "alta" | "media" | "baja";
  origen?: "conteo_planta" | "rundown" | "manual";
  fecha_requerida?: string;
  turno?: string;
  id_conteo?: number;
  comentario?: string;
  id_usuario_solicitante?: number;
  items: PedidoItemInput[];
}

export interface PedidoItemOut {
  id_material: string;
  nombre_material?: string;
  unidad?: string;
  cantidad_pedida: number;
  cantidad_preparada: number;
  cantidad_entregada: number;
  cantidad_pendiente?: number;
  estado: string;
  comentario?: string;
  tipo_empaque?: string;
  tamanio_lote?: number;
  bultos_por_pallet?: number | null;
  unidad_por_bulto?: number | null;
  cantidad_pallets?: number | null;
  cantidad_pallets_preparada?: number | null;
  cantidad_pallets_entregada?: number | null;
  cantidad_pallets_pendiente?: number | null;
  cantidad_bultos?: number | null;
  cantidad_bultos_preparada?: number | null;
  cantidad_bultos_entregada?: number | null;
  cantidad_bultos_pendiente?: number | null;
}

export interface RemitoItemOut {
  id_material: string;
  nombre_material?: string | null;
  unidad?: string;
  cantidad: number;
  tipo_empaque?: string;
  tamanio_lote?: number;
  cantidad_pallets?: number | null;
  bultos_por_pallet?: number | null;
  cantidad_bultos?: number | null;
}

export interface RemitoDetalleOut {
  id_remito: string;
  id_pedido: number;
  fecha_emision: string;
  fecha_entrega?: string | null;
  estado: string;
  id_usuario_emisor?: number | null;
  usuario_emisor?: string | null;
  observacion?: string | null;
  sector_destino?: string | null;
  usuario_solicitante?: string | null;
  fecha_requerida?: string | null;
  turno?: string | null;
  total_items: number;
  total_pallets: number;
  total_unidades: number;
  items: RemitoItemOut[];
}

export interface PedidoOut {
  id_pedido: number;
  sector: string;
  prioridad: string;
  origen: string;
  estado: string;
  fecha_creacion: string;
  fecha_despacho?: string | null;
  fecha_entrega?: string | null;
  fecha_requerida?: string | null;
  turno?: string | null;
  id_conteo?: number | null;
  comentario?: string | null;
  id_usuario_solicitante?: number | null;
  usuario_solicitante?: string | null;
  id_remito?: string | null;
  remitos?: RemitoDetalleOut[];
  total_items: number;
  items: PedidoItemOut[];
  es_demorado?: boolean;
}

export interface PedidosListResponse {
  items: PedidoOut[];
  total: number;
}

export async function calcularSugerenciaPedido(
  req: CalcularSugerenciaRequest
): Promise<CalcularSugerenciaResponse> {
  const res = await fetch(`${API_BASE_URL}/api/pedidos/calcular-sugerencia`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al calcular sugerencia de pedido");
  }
  return res.json();
}

export interface ReglaSugerenciaConfigApi {
  factor_consumo_siguiente: number;
  descripcion?: string | null;
  fecha_actualizacion?: string | null;
}

export async function getReglaSugerenciaConfig(): Promise<ReglaSugerenciaConfigApi> {
  const res = await fetch(`${API_BASE_URL}/api/pedidos/regla-sugerencia`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener regla de sugerencia");
  }
  return res.json();
}

export async function updateReglaSugerenciaConfig(data: {
  factor_consumo_siguiente: number;
}): Promise<ReglaSugerenciaConfigApi> {
  const res = await fetch(`${API_BASE_URL}/api/pedidos/regla-sugerencia`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar regla de sugerencia");
  }
  return res.json();
}

export async function createPedido(data: PedidoCreate): Promise<PedidoOut> {
  const res = await fetch(`${API_BASE_URL}/api/pedidos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear pedido");
  }
  return res.json();
}

export async function createPedidosMultiples(pedidos: PedidoCreate[]): Promise<PedidoOut[]> {
  const res = await fetch(`${API_BASE_URL}/api/pedidos/multiples`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(pedidos),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear pedidos");
  }
  return res.json();
}

export async function getPedidos(params?: {
  fecha_requerida?: string;
  estado?: string;
  turno?: string;
  sector?: string;
  limit?: number;
}): Promise<PedidosListResponse> {
  if (IS_SUPABASE_ACTIVE) {
    const query = new URLSearchParams();
    query.append("select", "*,pedidos_cl2_detalle(*)");
    query.append("order", "id_pedido.desc");
    if (params?.estado) query.append("estado", `eq.${params.estado}`);
    if (params?.turno) query.append("turno", `eq.${params.turno}`);
    if (params?.limit) query.append("limit", String(params.limit));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_cl2?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al cargar pedidos desde Supabase");
    }

    interface SupabaseItemDetalle {
      id_material: string;
      nombre_material?: string;
      unidad?: string;
      cantidad_pedida: number;
      cantidad_preparada?: number;
      cantidad_entregada?: number;
      tipo_empaque?: string;
      tamanio_lote?: number;
      bultos_por_pallet?: number;
      unidad_por_bulto?: number;
      cantidad_pallets?: number;
      cantidad_pallets_preparada?: number;
      cantidad_pallets_entregada?: number;
      cantidad_pallets_pendiente?: number;
      estado?: string;
      comentario?: string;
    }

    interface SupabasePedidoRow {
      id_pedido: number;
      sector: string;
      prioridad: string;
      origen: string;
      estado: string;
      fecha_creacion: string;
      fecha_despacho?: string | null;
      fecha_entrega?: string | null;
      fecha_requerida?: string | null;
      turno?: string | null;
      comentario?: string | null;
      pedidos_cl2_detalle?: SupabaseItemDetalle[];
    }

    const rows = (await res.json()) as SupabasePedidoRow[];
    const items: PedidoOut[] = rows.map((p) => {
      const detalle = p.pedidos_cl2_detalle || [];
      return {
        id_pedido: p.id_pedido,
        sector: p.sector,
        prioridad: p.prioridad,
        origen: p.origen,
        estado: p.estado,
        fecha_creacion: p.fecha_creacion,
        fecha_despacho: p.fecha_despacho,
        fecha_entrega: p.fecha_entrega,
        fecha_requerida: p.fecha_requerida,
        turno: p.turno,
        comentario: p.comentario,
        total_items: detalle.length,
        items: detalle.map((it) => ({
          id_material: it.id_material,
          nombre_material: it.nombre_material || it.id_material,
          unidad: it.unidad || "UN",
          cantidad_pedida: Number(it.cantidad_pedida),
          cantidad_preparada: Number(it.cantidad_preparada || 0),
          cantidad_entregada: Number(it.cantidad_entregada || 0),
          tipo_empaque: it.tipo_empaque || "unidad",
          tamanio_lote: Number(it.tamanio_lote || 1),
          bultos_por_pallet: it.bultos_por_pallet != null ? Number(it.bultos_por_pallet) : undefined,
          unidad_por_bulto: it.unidad_por_bulto != null ? Number(it.unidad_por_bulto) : undefined,
          cantidad_pallets: it.cantidad_pallets != null ? Number(it.cantidad_pallets) : null,
          cantidad_pallets_preparada: it.cantidad_pallets_preparada != null ? Number(it.cantidad_pallets_preparada) : 0,
          cantidad_pallets_entregada: it.cantidad_pallets_entregada != null ? Number(it.cantidad_pallets_entregada) : 0,
          cantidad_pallets_pendiente: it.cantidad_pallets_pendiente != null ? Number(it.cantidad_pallets_pendiente) : (it.cantidad_pallets != null ? Number(it.cantidad_pallets) : null),
          estado: it.estado || "pendiente",
          comentario: it.comentario,
        })),
      };
    });
    return { items, total: items.length };
  }

  const query = new URLSearchParams();
  if (params?.fecha_requerida) query.append("fecha_requerida", params.fecha_requerida);
  if (params?.estado) query.append("estado", params.estado);
  if (params?.turno) query.append("turno", params.turno);
  if (params?.sector) query.append("sector", params.sector);
  if (params?.limit) query.append("limit", String(params.limit));

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/pedidos${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cargar pedidos");
  }
  return res.json();
}

export async function getPedidoDetalle(idPedido: number): Promise<PedidoOut> {
  if (IS_SUPABASE_ACTIVE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_cl2?id_pedido=eq.${idPedido}&select=*,pedidos_cl2_detalle(*)`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Error al obtener detalle del pedido");
    }

    interface SupabaseItemDetalle {
      id_material: string;
      nombre_material?: string;
      unidad?: string;
      cantidad_pedida: number;
      cantidad_preparada?: number;
      cantidad_entregada?: number;
      tipo_empaque?: string;
      tamanio_lote?: number;
      bultos_por_pallet?: number;
      unidad_por_bulto?: number;
      cantidad_pallets?: number;
      cantidad_pallets_preparada?: number;
      cantidad_pallets_entregada?: number;
      cantidad_pallets_pendiente?: number;
      estado?: string;
      comentario?: string;
    }

    interface SupabasePedidoRow {
      id_pedido: number;
      sector: string;
      prioridad: string;
      origen: string;
      estado: string;
      fecha_creacion: string;
      fecha_despacho?: string | null;
      fecha_entrega?: string | null;
      fecha_requerida?: string | null;
      turno?: string | null;
      comentario?: string | null;
      pedidos_cl2_detalle?: SupabaseItemDetalle[];
    }

    const rows = (await res.json()) as SupabasePedidoRow[];
    if (!rows || rows.length === 0) {
      throw new Error(`Pedido #${idPedido} no encontrado`);
    }
    const p = rows[0];
    const detalle = p.pedidos_cl2_detalle || [];
    return {
      id_pedido: p.id_pedido,
      sector: p.sector,
      prioridad: p.prioridad,
      origen: p.origen,
      estado: p.estado,
      fecha_creacion: p.fecha_creacion,
      fecha_despacho: p.fecha_despacho,
      fecha_entrega: p.fecha_entrega,
      fecha_requerida: p.fecha_requerida,
      turno: p.turno,
      comentario: p.comentario,
      total_items: detalle.length,
      items: detalle.map((it) => ({
        id_material: it.id_material,
        nombre_material: it.nombre_material || it.id_material,
        unidad: it.unidad || "UN",
        cantidad_pedida: Number(it.cantidad_pedida),
        cantidad_preparada: Number(it.cantidad_preparada || 0),
        cantidad_entregada: Number(it.cantidad_entregada || 0),
        tipo_empaque: it.tipo_empaque || "unidad",
        tamanio_lote: Number(it.tamanio_lote || 1),
        bultos_por_pallet: it.bultos_por_pallet != null ? Number(it.bultos_por_pallet) : undefined,
        unidad_por_bulto: it.unidad_por_bulto != null ? Number(it.unidad_por_bulto) : undefined,
        cantidad_pallets: it.cantidad_pallets != null ? Number(it.cantidad_pallets) : null,
        cantidad_pallets_preparada: it.cantidad_pallets_preparada != null ? Number(it.cantidad_pallets_preparada) : 0,
        cantidad_pallets_entregada: it.cantidad_pallets_entregada != null ? Number(it.cantidad_pallets_entregada) : 0,
        cantidad_pallets_pendiente: it.cantidad_pallets_pendiente != null ? Number(it.cantidad_pallets_pendiente) : (it.cantidad_pallets != null ? Number(it.cantidad_pallets) : null),
        estado: it.estado || "pendiente",
        comentario: it.comentario,
      })),
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/pedidos/${idPedido}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener detalle del pedido");
  }
  return res.json();
}

export interface PreparacionItemUpdate {
  id_material: string;
  cantidad_preparada: number;
  cantidad_pallets_preparada?: number | null;
  estado?: string;
  comentario?: string;
}

export interface PreparacionPedidoUpdate {
  accion: "guardar_avance" | "confirmar_parcial" | "confirmar_completo";
  comentario?: string;
  items: PreparacionItemUpdate[];
}

export async function updatePreparacionPedido(
  idPedido: number,
  data: PreparacionPedidoUpdate
): Promise<{ pedido: PedidoOut; id_remito?: string; mensaje: string }> {
  if (IS_SUPABASE_ACTIVE) {
    const nuevoEstado =
      data.accion === "confirmar_completo"
        ? "completo"
        : data.accion === "confirmar_parcial"
        ? "parcial"
        : "en_preparacion";

    for (const it of data.items) {
      const patchData: Record<string, any> = {
        cantidad_preparada: it.cantidad_preparada,
        estado: it.estado || (nuevoEstado === "completo" ? "completo" : "en_preparacion"),
        comentario: it.comentario || null,
      };
      if (it.cantidad_pallets_preparada !== undefined && it.cantidad_pallets_preparada !== null) {
        patchData.cantidad_pallets_preparada = it.cantidad_pallets_preparada;
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/pedidos_cl2_detalle?id_pedido=eq.${idPedido}&id_material=eq.${encodeURIComponent(it.id_material)}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(patchData),
        }
      );
    }

    const savedUser = localStorage.getItem("auth_user");
    let preparador = "Operario CL2";
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser) as { nombre?: string; apellido?: string; username?: string };
        preparador = `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.username || preparador;
      } catch {
        preparador = "Operario CL2";
      }
    }

    interface PedidoPatchPayload {
      estado: string;
      preparado_por_nombre: string;
      fecha_despacho?: string;
    }

    const payloadPedido: PedidoPatchPayload = {
      estado: nuevoEstado,
      preparado_por_nombre: preparador,
    };
    if (nuevoEstado === "completo" || nuevoEstado === "parcial") {
      payloadPedido.fecha_despacho = new Date().toISOString();
    }

    await fetch(`${SUPABASE_URL}/rest/v1/pedidos_cl2?id_pedido=eq.${idPedido}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(payloadPedido),
    });

    let idRemitoGenerado: string | undefined = undefined;
    if (nuevoEstado === "completo" || nuevoEstado === "parcial") {
      idRemitoGenerado = `REM-CL2-${idPedido}-${Date.now().toString().slice(-4)}`;
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/remitos_cl2`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id_remito: idRemitoGenerado,
            id_pedido: idPedido,
            fecha_emision: new Date().toISOString(),
            estado: "emitido",
            operador_nombre: preparador,
            observacion: data.comentario || null,
          }),
        });

        const remitoItems = data.items
          .filter((it) => it.cantidad_preparada > 0)
          .map((it) => ({
            id_remito: idRemitoGenerado,
            id_material: it.id_material,
            cantidad: it.cantidad_preparada,
          }));

        if (remitoItems.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/remitos_cl2_detalle`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(remitoItems),
          });
        }
      } catch {}
    }

    const pedidoActualizado = await getPedidoDetalle(idPedido);
    return {
      pedido: pedidoActualizado,
      id_remito: idRemitoGenerado,
      mensaje: `Pedido #${idPedido} actualizado a ${nuevoEstado}`,
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/pedidos/${idPedido}/preparacion`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al procesar preparación del pedido");
  }
  return res.json();
}

export async function cancelarPedido(idPedido: number, motivo: string): Promise<PedidoOut> {
  const res = await fetch(`${API_BASE_URL}/api/pedidos/${idPedido}/cancelar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ motivo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cancelar el pedido");
  }
  return res.json();
}

export async function getRemitoDetalle(idRemito: string): Promise<RemitoDetalleOut> {
  if (IS_SUPABASE_ACTIVE) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/remitos_cl2?id_remito=eq.${encodeURIComponent(idRemito)}&select=*,remitos_cl2_detalle(*)`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const r = rows[0];
          const ped = await getPedidoDetalle(r.id_pedido).catch(() => null);
          const detalle = r.remitos_cl2_detalle || [];
          return {
            id_remito: r.id_remito,
            id_pedido: r.id_pedido,
            fecha_emision: r.fecha_emision,
            fecha_entrega: r.fecha_entrega,
            estado: r.estado || "emitido",
            usuario_emisor: r.operador_nombre,
            observacion: r.observacion,
            sector_destino: ped?.sector || "PLANTA",
            usuario_solicitante: ped?.usuario_solicitante || "Solicitante",
            fecha_requerida: ped?.fecha_requerida,
            turno: ped?.turno,
            total_items: detalle.length,
            total_pallets: detalle.reduce((acc: number, it: any) => {
              const mat = ped?.items.find((m) => m.id_material === it.id_material);
              return acc + (mat?.cantidad_pallets_preparada || 0);
            }, 0),
            total_unidades: detalle.reduce((acc: number, it: any) => acc + Number(it.cantidad || 0), 0),
            items: detalle.map((it: any) => {
              const mat = ped?.items.find((m) => m.id_material === it.id_material);
              return {
                id_material: it.id_material,
                nombre_material: mat?.nombre_material || it.id_material,
                unidad: mat?.unidad || "UN",
                cantidad: Number(it.cantidad),
                tipo_empaque: mat?.tipo_empaque || "unidad",
                tamanio_lote: mat?.tamanio_lote || 1,
                cantidad_pallets: mat?.cantidad_pallets_preparada,
                bultos_por_pallet: mat?.bultos_por_pallet,
              };
            }),
          };
        }
      }
    } catch {}
  }

  const res = await fetch(`${API_BASE_URL}/api/pedidos/remitos/${idRemito}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener detalle del remito");
  }
  return res.json();
}

export async function getRemitosByPedido(idPedido: number): Promise<RemitoDetalleOut[]> {
  if (IS_SUPABASE_ACTIVE) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/remitos_cl2?id_pedido=eq.${idPedido}&select=*,remitos_cl2_detalle(*)`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const rows = await res.json();
        const list: RemitoDetalleOut[] = [];
        for (const r of rows) {
          const detail = await getRemitoDetalle(r.id_remito).catch(() => null);
          if (detail) list.push(detail);
        }
        return list;
      }
    } catch {}
    return [];
  }

  const res = await fetch(`${API_BASE_URL}/api/pedidos/${idPedido}/remitos`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener remitos del pedido");
  }
  return res.json();
}

export interface MaterialConfigItem {
  id_material: string;
  nombre: string;
  unidad: string;
  categoria?: string | null;
  id_proveedor?: number | null;
  nombre_proveedor?: string | null;
  deposito_en_planta: boolean;
  tipo_empaque: "pallet" | "rollo" | "unidad";
  lote_mts?: number | null;
  unidad_por_bulto?: number | null;
  bultos_por_pallet?: number | null;
  doh_sugerido_planta: number;
  id_parametro?: number | null;
  activo: boolean;
  en_cl2: boolean;
}

export interface MaterialConfigListResponse {
  items: MaterialConfigItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MaterialConfigUpdate {
  id_material: string;
  id_proveedor?: number | null;
  deposito_en_planta: boolean;
  tipo_empaque: "pallet" | "rollo" | "unidad";
  lote_mts?: number | null;
  unidad_por_bulto?: number | null;
  bultos_por_pallet?: number | null;
  doh_sugerido_planta: number;
  unidad?: string | null;
  en_cl2?: boolean | null;
}

export async function getMaterialesConfiguracion(params?: {
  search?: string;
  id_proveedor?: number;
  tipo_empaque?: string;
  en_cl2?: boolean;
  page?: number;
  page_size?: number;
}): Promise<MaterialConfigListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.id_proveedor) query.append("id_proveedor", String(params.id_proveedor));
  if (params?.tipo_empaque && params.tipo_empaque !== "all") query.append("tipo_empaque", params.tipo_empaque);
  if (params?.en_cl2 !== undefined) query.append("en_cl2", String(params.en_cl2));
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));

  const res = await fetch(`${API_BASE_URL}/api/stock/configuracion-materiales?${query.toString()}`);
  if (!res.ok) throw new Error("Error al obtener la configuración de materiales");
  return res.json();
}

export async function updateMaterialConfiguracion(data: MaterialConfigUpdate): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_BASE_URL}/api/stock/configuracion-materiales`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar la configuración del material");
  }
  return res.json();
}

export type RolUsuario =
  | "administrador"
  | "gerente"
  | "jefe"
  | "analista"
  | "deposito"
  | "contador_ciclico"
  | "operario_deposito"
  | "operario_planta"
  | "supervisor"
  | "solicitante";

export interface UsuarioItem {
  id_usuario: number | string;
  username: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  sector: string;
  email?: string | null;
  activo: boolean;
  eliminado?: boolean;
  fecha_creacion?: string | null;
  ultimo_acceso?: string | null;
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioItem;
}

export interface UsuarioCreateInput {
  username: string;
  password: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  sector: string;
  email?: string;
  activo?: boolean;
}

export interface UsuarioUpdateInput {
  nombre?: string;
  apellido?: string;
  rol?: RolUsuario;
  sector?: string;
  email?: string | null;
  activo?: boolean;
}

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  if (IS_SUPABASE_ACTIVE) {
    return {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  if (IS_SUPABASE_ACTIVE) {
    const cleanUser = username.trim();
    const email = cleanUser.includes("@") ? cleanUser : `${cleanUser}@cl2.com`;

    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
      const err = await authRes.json().catch(() => ({}));
      throw new Error(err.error_description || err.msg || err.message || "Usuario o contraseña incorrectos.");
    }

    const authData = await authRes.json();
    const token = authData.access_token as string;
    const userId = authData.user?.id as string;

    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_perfil?id=eq.${userId}&select=*`, {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    interface SupabaseProfile {
      id?: string;
      nombre?: string;
      apellido?: string;
      rol?: string;
      sector?: string;
      email?: string;
      activo?: boolean;
      created_at?: string;
    }

    let profile: SupabaseProfile | null = null;
    if (profileRes.ok) {
      const profiles = (await profileRes.json()) as SupabaseProfile[];
      if (Array.isArray(profiles) && profiles.length > 0) {
        profile = profiles[0];
      }
    }

    const usuario: UsuarioItem = {
      id_usuario: profile?.id || userId,
      username: profile?.nombre || cleanUser,
      nombre: profile?.nombre || cleanUser,
      apellido: profile?.apellido || "",
      rol: (profile?.rol as RolUsuario) || "operario_deposito",
      sector: profile?.sector || "CL2",
      email: profile?.email || authData.user?.email || email,
      activo: profile?.activo ?? true,
      fecha_creacion: profile?.created_at || null,
    };

    return { token, usuario };
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Usuario o contraseña incorrectos.");
  }
  return res.json();
}

export async function getMe(): Promise<UsuarioItem> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    throw new Error("Sesión inválida o expirada.");
  }

  if (IS_SUPABASE_ACTIVE) {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) {
      throw new Error("Sesión inválida o expirada.");
    }

    const authUser = await userRes.json();
    const userId = authUser.id;

    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_perfil?id=eq.${userId}&select=*`, {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    interface SupabaseProfile {
      id?: string;
      nombre?: string;
      apellido?: string;
      rol?: string;
      sector?: string;
      email?: string;
      activo?: boolean;
      created_at?: string;
    }

    let profile: SupabaseProfile | null = null;
    if (profileRes.ok) {
      const profiles = (await profileRes.json()) as SupabaseProfile[];
      if (Array.isArray(profiles) && profiles.length > 0) {
        profile = profiles[0];
      }
    }

    return {
      id_usuario: profile?.id || userId,
      username: profile?.nombre || authUser.email?.split("@")[0] || "operario",
      nombre: profile?.nombre || "Operario",
      apellido: profile?.apellido || "CL2",
      rol: (profile?.rol as RolUsuario) || "operario_deposito",
      sector: profile?.sector || "CL2",
      email: profile?.email || authUser.email,
      activo: profile?.activo ?? true,
      fecha_creacion: profile?.created_at || null,
    };
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Sesión inválida o expirada.");
  }
  return res.json();
}

export async function getUsuarios(params?: {
  rol?: string;
  sector?: string;
  solo_activos?: boolean;
}): Promise<UsuarioItem[]> {
  const query = new URLSearchParams();
  if (params?.rol && params.rol !== "TODOS") query.append("rol", params.rol);
  if (params?.sector && params.sector !== "TODOS") query.append("sector", params.sector);
  if (params?.solo_activos) query.append("solo_activos", "true");

  const res = await fetch(`${API_BASE_URL}/api/usuarios?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener la lista de usuarios.");
  }
  return res.json();
}

export async function createUsuario(data: UsuarioCreateInput): Promise<UsuarioItem> {
  const res = await fetch(`${API_BASE_URL}/api/usuarios`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear el usuario.");
  }
  return res.json();
}

export async function updateUsuario(id_usuario: number, data: UsuarioUpdateInput): Promise<UsuarioItem> {
  const res = await fetch(`${API_BASE_URL}/api/usuarios/${id_usuario}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar el usuario.");
  }
  return res.json();
}

export async function changeUsuarioPassword(id_usuario: number, password_nuevo: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/usuarios/${id_usuario}/password`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ password_nuevo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cambiar la contraseña.");
  }
  return res.json();
}

export async function deleteUsuario(id_usuario: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/usuarios/${id_usuario}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al desactivar el usuario.");
  }
  return res.json();
}

export interface DashboardKpis {
  pedidos_pendientes: number;
  pedidos_en_preparacion: number;
  pedidos_parciales: number;
  pedidos_completados_hoy: number;
  total_pedidos: number;
  materiales_criticos_count: number;
  criticos_planta_count?: number;
  criticos_tbar_count?: number;
  remitos_hoy: number;
  fill_rate_porcentaje: number;
  turno_actual: string;
}

export interface DashboardPedidoItem {
  id_pedido: number;
  sector: string;
  prioridad: string;
  estado: string;
  fecha_creacion?: string | null;
  fecha_requerida?: string | null;
  turno?: string | null;
  usuario_solicitante?: string | null;
  total_items: number;
  id_remito?: string | null;
  es_demorado?: boolean;
}

export interface DashboardMaterialCritico {
  id_material: string;
  nombre: string;
  unidad: string;
  stock_cl2: number;
  stock_planta: number;
  stock_total: number;
  nombre_proveedor?: string | null;
  alerta_tipo: string;
  alerta_label: string;
  prioridad: "critica" | "alta" | "media";
  origen_alerta?: "planta" | "tbar" | "ambos";
}

export interface DashboardResumenResponse {
  kpis: DashboardKpis;
  ultimos_pedidos: DashboardPedidoItem[];
  materiales_criticos: DashboardMaterialCritico[];
}

export async function getDashboardResumen(): Promise<DashboardResumenResponse> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/resumen`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener resumen del dashboard");
  }
  return res.json();
}

export interface IngresoDetalleCreate {
  id_material: string;
  cantidad_facturada: number;
  observacion?: string;
}

export interface IngresoCreate {
  id_proveedor: number;
  numero_factura: string;
  orden_compra?: string;
  fecha_emision?: string;
  observacion?: string;
  confirmar_inmediato?: boolean;
  fecha_recepcion?: string;
  items: IngresoDetalleCreate[];
}

export interface IngresoRecepcionItem {
  id_material: string;
  cantidad_recibida: number;
  conforme?: boolean;
  observacion?: string;
}

export interface IngresoConfirmarRecepcion {
  fecha_recepcion?: string;
  observacion?: string;
  items: IngresoRecepcionItem[];
}

export interface IngresoDetalleOut {
  id_ingreso_detalle: number;
  id_material: string;
  nombre_material?: string;
  unidad: string;
  cantidad_facturada: number;
  cantidad_recibida?: number | null;
  conforme: boolean;
  observacion?: string;
}

export interface IngresoOut {
  id_ingreso: number;
  id_proveedor: number;
  nombre_proveedor?: string;
  codigo_proveedor?: string;
  deposito_en_planta: boolean;
  numero_factura: string;
  orden_compra?: string;
  estado: "pendiente" | "parcial" | "completo";
  fecha_emision?: string;
  fecha_recepcion?: string | null;
  id_usuario_creacion?: number | null;
  usuario_creacion?: string | null;
  id_usuario_recepcion?: number | null;
  usuario_recepcion?: string | null;
  observacion?: string | null;
  total_items: number;
  items: IngresoDetalleOut[];
}

export interface ParsedInvoiceItem {
  id_material: string;
  nombre_material?: string | null;
  unidad?: string | null;
  cantidad_facturada: number;
  confianza: number;
  linea_origen?: string | null;
}

export interface ParsedInvoiceResult {
  id_proveedor?: number | null;
  nombre_proveedor?: string | null;
  codigo_proveedor?: string | null;
  numero_factura?: string | null;
  orden_compra?: string | null;
  fecha_emision?: string | null;
  items: ParsedInvoiceItem[];
  total_paginas: number;
  warnings: string[];
  debug_log_file?: string | null;
}

export async function parseInvoicePdf(file: File): Promise<ParsedInvoiceResult> {
  const formData = new FormData();
  formData.append("file", file);
  const token = localStorage.getItem("auth_token");
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE_URL}/api/ingresos/parse-document`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al procesar el archivo PDF con OCR");
  }
  return res.json();
}


export async function getIngresos(params?: {
  estado?: string;
  id_proveedor?: number;
  search?: string;
}): Promise<IngresoOut[]> {
  const q = new URLSearchParams();
  if (params?.estado && params.estado !== "all") q.append("estado", params.estado);
  if (params?.id_proveedor && params.id_proveedor > 0) q.append("id_proveedor", String(params.id_proveedor));
  if (params?.search) q.append("search", params.search);
  const qs = q.toString() ? `?${q.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/api/ingresos${qs}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener comprobantes de ingreso");
  return res.json();
}

export async function getIngresoById(idIngreso: number): Promise<IngresoOut> {
  const res = await fetch(`${API_BASE_URL}/api/ingresos/${idIngreso}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Error al obtener comprobante #${idIngreso}`);
  return res.json();
}

export async function createIngreso(data: IngresoCreate, idUsuario?: number): Promise<IngresoOut> {
  const qs = idUsuario ? `?id_usuario=${idUsuario}` : "";
  const res = await fetch(`${API_BASE_URL}/api/ingresos${qs}`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al registrar comprobante de ingreso");
  }
  return res.json();
}

export async function confirmarRecepcionIngreso(
  idIngreso: number,
  data: IngresoConfirmarRecepcion,
  idUsuario?: number
): Promise<IngresoOut> {
  const qs = idUsuario ? `?id_usuario=${idUsuario}` : "";
  const res = await fetch(`${API_BASE_URL}/api/ingresos/${idIngreso}/recepcion${qs}`, {
    method: "PUT",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al confirmar recepción en depósito");
  }
  return res.json();
}

export async function deleteIngreso(idIngreso: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/ingresos/${idIngreso}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error al eliminar comprobante #${idIngreso}`);
  }
}

export interface TraceEvent {
  timestamp: string;
  action: string;
  user: string;
  role: string;
  detail: string;
  type: "solicitud" | "aprobacion" | "preparacion" | "entrega" | "ajuste" | "sistema";
}

export interface TraceOrder {
  id: string;
  number: string;
  sector: string;
  status: string;
  events: TraceEvent[];
}

export interface AuditListResponse {
  orders: TraceOrder[];
  total_orders: number;
}

export async function getAuditoriaPedidos(params?: {
  search?: string;
  sector?: string;
  estado?: string;
  limit?: number;
}): Promise<AuditListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.sector) query.append("sector", params.sector);
  if (params?.estado) query.append("estado", params.estado);
  if (params?.limit) query.append("limit", String(params.limit));

  const qs = query.toString();
  const url = `${API_BASE_URL}/api/auditoria/pedidos${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener historial de auditoría");
  }
  return res.json();
}



