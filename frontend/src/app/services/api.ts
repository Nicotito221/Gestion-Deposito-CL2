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
  tentative_total: number;
  total: number;
  status: string;
}

export interface SupplySummaryApi {
  periodo: string;
  total_demanda: number;
  piezas_validadas: number;
  total_piezas: number;
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
