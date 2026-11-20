const PLANIFICACION = ["administrador", "gerente", "jefe", "analista"];

export const PERMISOS_RUTA: Record<string, string[]> = {
  "/nuevo-pedido": [...PLANIFICACION, "contador_ciclico", "solicitante", "operario_planta"],
  "/deposito": [...PLANIFICACION, "deposito", "operario_deposito"],
  "/remitos": [...PLANIFICACION, "deposito", "operario_deposito"],
  "/materiales": [...PLANIFICACION],
  "/conteo": [...PLANIFICACION, "contador_ciclico", "operario_planta"],
  "/rundown": [...PLANIFICACION, "operario_planta", "supervisor"],
  "/suministro-bom": [...PLANIFICACION, "operario_planta", "supervisor"],
  "/despachos-terceros": [...PLANIFICACION, "operario_planta", "supervisor"],
  "/stock": [...PLANIFICACION, "operario_planta", "supervisor"],
  "/configuracion-materiales": [...PLANIFICACION, "supervisor"],
  "/trazabilidad": [...PLANIFICACION, "supervisor"],
  "/conteo-ciclico": [...PLANIFICACION, "contador_ciclico"],
  "/proveedores": [...PLANIFICACION, "supervisor"],
  "/usuarios": ["administrador"],
};
