import unicodedata
from typing import Dict, List, Optional, Tuple

import openpyxl

from app.repositories.conversion_orden_repository import ConversionOrdenRepository
from app.schemas.supply import ConversionOrdenImportResult, ConversionOrdenResumen, DemandRowOut
from consolidate_production import clean_code, format_part_number


class ConversionOrdenError(ValueError):
    pass


def _texto_celda(valor: object) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    return str(valor).strip().upper()


def clave_pn(valor: Optional[str]) -> str:
    return clean_code(format_part_number(valor)) if valor else ""


def _nombre_hoja(nombre: str) -> str:
    sin_acentos = "".join(c for c in unicodedata.normalize("NFKD", nombre) if not unicodedata.combining(c))
    return sin_acentos.lower().replace(" ", "")


class ConversionOrdenService:
    def __init__(self, repository: Optional[ConversionOrdenRepository] = None) -> None:
        self.repository = repository or ConversionOrdenRepository()

    def importar(self, path: str, nombre_archivo: str) -> ConversionOrdenImportResult:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        try:
            hojas = {_nombre_hoja(ws.title): ws for ws in wb.worksheets}
            hoja_osum = next((ws for n, ws in hojas.items() if "osum" in n), None)
            hoja_conv = next((ws for n, ws in hojas.items() if "conversion" in n), None)
            if hoja_osum is None or hoja_conv is None:
                raise ConversionOrdenError(
                    'El archivo debe tener las hojas "OSum" y "Conversion tasa sap".'
                )

            tasa_a_sap: Dict[str, str] = {}
            for fila in hoja_conv.iter_rows(min_row=2, max_col=2, values_only=True):
                tasa, sap = _texto_celda(fila[0]), _texto_celda(fila[1])
                clave = clave_pn(tasa)
                if clave and sap and clave not in tasa_a_sap:
                    tasa_a_sap[clave] = sap[:30]

            conversiones: Dict[str, Tuple[str, Optional[str]]] = {}
            for fila in hoja_osum.iter_rows(min_row=2, max_col=2, values_only=True):
                pn_orden = clave_pn(_texto_celda(fila[0]))[:30]
                tasa = _texto_celda(fila[1])[:30]
                if pn_orden and tasa and pn_orden not in conversiones:
                    conversiones[pn_orden] = (tasa, tasa_a_sap.get(clave_pn(tasa)))
        finally:
            wb.close()

        if not conversiones:
            raise ConversionOrdenError('La hoja "OSum" no tiene filas con N°Parte y Codigo TASA+TBAR.')

        filas = [(pn, tasa, sap) for pn, (tasa, sap) in conversiones.items()]
        self.repository.reemplazar(filas, nombre_archivo)
        return ConversionOrdenImportResult(
            nombre_archivo=nombre_archivo,
            total_conversiones=len(filas),
            con_codigo_sap=sum(1 for _, _, sap in filas if sap),
            sin_codigo_sap=sorted(tasa for _, tasa, sap in filas if not sap),
        )

    def resumen(self) -> ConversionOrdenResumen:
        return self.repository.resumen()

    def aplicar(self, items: List[DemandRowOut]) -> Tuple[List[DemandRowOut], List[Tuple[str, str]], List[str]]:
        padres = {clean_code(p): p for p in self.repository.obtener_padres_bom_vigente()}
        mapa = self.repository.obtener_mapa()

        convertidos: List[Tuple[str, str]] = []
        sin_match: List[str] = []
        resultado: Dict[str, DemandRowOut] = {}

        for item in items:
            canon = clean_code(item.part_number)
            destino = padres.get(canon, item.part_number)
            if canon not in padres:
                tasa, sap = mapa.get(clave_pn(item.part_number), (None, None))
                candidato = next(
                    (padres[clean_code(c)] for c in (sap, tasa) if c and clean_code(c) in padres),
                    sap or tasa,
                )
                if candidato and clean_code(candidato) != canon:
                    destino = candidato
                    convertidos.append((item.part_number, destino))
                else:
                    sin_match.append(item.part_number)

            previo = resultado.get(destino)
            if previo is None:
                resultado[destino] = item.model_copy(update={"part_number": destino}, deep=True)
                continue
            for col, val in item.daily_values.items():
                previo.daily_values[col] = previo.daily_values.get(col, 0.0) + val
            for col, val in item.tentative_values.items():
                previo.tentative_values[col] = previo.tentative_values.get(col, 0.0) + val
            previo.tentative_total += item.tentative_total
            previo.total += item.total

        unificados = [it.model_copy(update={"id": str(i + 1)}) for i, it in enumerate(resultado.values())]
        return unificados, convertidos, sin_match
