import csv
import io
import os
from decimal import Decimal, InvalidOperation
from typing import BinaryIO, Dict, Iterator, List, Optional, Set, Tuple, Union

import openpyxl

from app.schemas.bom import (
    BomComponenteDirecto,
    BomParseResult,
    BomRelationRecord,
    MaterialRecord,
    SdParseResult,
    SdSetRecord,
)


def clean_quantity(raw: Union[str, float, int, None]) -> Decimal:
    if raw is None:
        return Decimal("1.0000")
    if isinstance(raw, (int, float)):
        return Decimal(str(raw))

    s = str(raw).strip()
    if not s or s in ("-", "N/A", "NULL", "NONE"):
        return Decimal("1.0000")

    if "." in s and "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")

    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal("1.0000")


def is_header_row(cols: List[str]) -> bool:
    for c in cols[:6]:
        cleaned = c.strip().upper()
        if cleaned in ("MATERIAL", "PARTE", "CODIGO", "Nº PARTE", "N° PARTE", "PART NUMBER", "HIJO"):
            return True
    return False


def extract_row_data(cols: List[str]) -> Optional[Tuple[int, str, str, Decimal, str]]:
    part_number: str = ""
    level: int = -1

    for idx in range(min(6, len(cols))):
        val = cols[idx].strip()
        if val:
            part_number = val.upper()
            level = idx
            break

    if not part_number or level == -1:
        return None

    if len(part_number) > 30:
        part_number = part_number[:30]

    desc: str = ""
    if len(cols) > 6 and cols[6].strip():
        desc = cols[6].strip()[:100]

    qty: Decimal = Decimal("1.0000")
    if len(cols) > 7 and cols[7].strip():
        qty = clean_quantity(cols[7])

    unit: str = "UN"
    if len(cols) > 8 and cols[8].strip():
        unit = cols[8].strip()[:10]

    return level, part_number, desc, qty, unit


def _columnas_por_encabezado(cols: List[str]) -> Optional[Tuple[int, int, int]]:
    def buscar(*claves: str) -> int:
        for idx in range(3, len(cols)):
            nombre = cols[idx].strip().upper()
            if nombre and any(nombre.startswith(c) for c in claves):
                return idx
        return -1

    c_desc = buscar("DESCRIP", "TEXTO", "PART NAME", "DENOMIN")
    c_cant = buscar("CANT", "CTD", "QTY", "USO")
    c_un = buscar("UNIDAD", "UM", "UOM", "UN")
    if c_cant == -1:
        return None
    return (
        c_desc if c_desc != -1 else c_cant - 1,
        c_cant,
        c_un if c_un != -1 else c_cant + 1,
    )


class BomParser:
    @staticmethod
    def parse(source: Union[str, BinaryIO, io.BytesIO]) -> BomParseResult:
        materiales: Dict[str, MaterialRecord] = {}
        relaciones: List[BomRelationRecord] = []
        current_stack: Dict[int, str] = {}
        ocurrencia_stack: Dict[int, int] = {}
        hijos_por_ocurrencia: Dict[int, List[BomComponenteDirecto]] = {}
        pieza_por_ocurrencia: Dict[int, str] = {}
        current_root_product: Optional[str] = None
        total_lineas = 0
        orden_secuencia = 0

        rows_iterator = BomParser._get_row_iterator(source)

        for raw_cols in rows_iterator:
            total_lineas += 1
            if not raw_cols:
                continue

            str_cols = [str(c) if c is not None else "" for c in raw_cols]
            if is_header_row(str_cols):
                continue

            extracted = extract_row_data(str_cols)
            if extracted is None:
                continue

            level, part_number, desc, qty, unit = extracted

            if part_number not in materiales:
                materiales[part_number] = MaterialRecord(
                    id_material=part_number,
                    nombre=desc or part_number,
                    unidad=unit or "UN"
                )
            elif desc and materiales[part_number].nombre == part_number:
                materiales[part_number].nombre = desc

            pieza_por_ocurrencia[total_lineas] = part_number

            if level == 0:
                current_root_product = part_number
                current_stack = {0: part_number}
                ocurrencia_stack = {0: total_lineas}
            else:
                if not current_root_product:
                    current_root_product = current_stack.get(0, part_number)

                id_padre = current_stack.get(level - 1)
                ocurrencia_padre = ocurrencia_stack.get(level - 1)
                if not id_padre:
                    for l in range(level - 1, -1, -1):
                        if l in current_stack:
                            id_padre = current_stack[l]
                            ocurrencia_padre = ocurrencia_stack.get(l)
                            break

                if id_padre and id_padre != part_number:
                    if ocurrencia_padre is not None:
                        hijos_por_ocurrencia.setdefault(ocurrencia_padre, []).append(
                            BomComponenteDirecto(id_hijo=part_number, cantidad=qty, unidad=unit)
                        )
                    orden_secuencia += 1
                    relaciones.append(
                        BomRelationRecord(
                            id_producto_raiz=current_root_product,
                            id_padre=id_padre,
                            id_hijo=part_number,
                            cantidad=qty,
                            unidad=unit,
                            nivel=level,
                            orden=orden_secuencia
                        )
                    )

                current_stack[level] = part_number
                current_stack = {k: v for k, v in current_stack.items() if k <= level}
                ocurrencia_stack[level] = total_lineas
                ocurrencia_stack = {k: v for k, v in ocurrencia_stack.items() if k <= level}

        hijos_por_padre: Dict[str, List[BomComponenteDirecto]] = {}
        for ocurrencia in sorted(hijos_por_ocurrencia):
            pieza = pieza_por_ocurrencia[ocurrencia]
            if pieza not in hijos_por_padre:
                hijos_por_padre[pieza] = hijos_por_ocurrencia[ocurrencia]

        return BomParseResult(
            materiales=materiales,
            relaciones=relaciones,
            total_lineas_archivo=total_lineas,
            hijos_por_padre=hijos_por_padre,
        )

    @staticmethod
    def parse_sd_sets(source: Union[str, BinaryIO, io.BytesIO]) -> SdParseResult:
        materiales: Dict[str, MaterialRecord] = {}
        sd_sets: Dict[Tuple[str, str], SdSetRecord] = {}
        set_productos: Dict[str, List[BomComponenteDirecto]] = {}
        bloque_actual: List[BomComponenteDirecto] = []
        set_actual: Optional[str] = None
        sd_actual: Optional[str] = None
        sd_desc: str = ""
        columnas: Optional[Tuple[int, int, int]] = None
        total_lineas = 0

        def cerrar_bloque() -> None:
            if set_actual and bloque_actual and set_actual not in set_productos:
                set_productos[set_actual] = list(bloque_actual)

        def registrar_material(codigo: str, desc: str, unidad: str) -> None:
            if codigo not in materiales:
                materiales[codigo] = MaterialRecord(id_material=codigo, nombre=(desc or codigo)[:100], unidad=unidad)
            elif desc and materiales[codigo].nombre == codigo:
                materiales[codigo].nombre = desc[:100]

        for raw_cols in BomParser._get_row_iterator(source):
            total_lineas += 1
            cols = [str(c).strip() if c is not None else "" for c in raw_cols] + [""] * 11

            if is_header_row(cols) or any(c.upper() in ("SD", "SET") for c in cols[:3]):
                detectadas = _columnas_por_encabezado(cols)
                if detectadas:
                    columnas = detectadas
                continue

            nivel = next((i for i in range(3) if cols[i]), -1)
            if nivel == -1:
                continue

            if columnas:
                c_desc, c_cant, c_un = columnas
            elif any(cols[i] for i in (8, 9, 10)):
                c_desc, c_cant, c_un = 8, 9, 10
            else:
                c_desc, c_cant, c_un = 3, 4, 5
            desc = cols[c_desc][:100]
            cantidad = clean_quantity(cols[c_cant])
            unidad = (cols[c_un] or "UN")[:10]

            if nivel == 0:
                cerrar_bloque()
                set_actual, bloque_actual = None, []
                sd_actual = cols[0].upper()[:30]
                sd_desc = desc
                if not cols[1]:
                    continue
                nivel = 1
                desc = ""

            if nivel == 1:
                cerrar_bloque()
                bloque_actual = []
                set_actual = cols[1].upper()[:30]
                registrar_material(set_actual, desc, unidad)
                if sd_actual and (sd_actual, set_actual) not in sd_sets:
                    sd_sets[(sd_actual, set_actual)] = SdSetRecord(
                        codigo_sd=sd_actual,
                        id_set=set_actual,
                        descripcion_sd=sd_desc,
                        cantidad=cantidad if cantidad > 0 else Decimal("1.0000"),
                        unidad=unidad,
                    )
                continue

            producto = cols[2].upper()[:30]
            if not set_actual or producto == set_actual or cantidad <= 0:
                continue
            registrar_material(producto, desc, unidad)
            bloque_actual.append(BomComponenteDirecto(id_hijo=producto, cantidad=cantidad, unidad=unidad))

        cerrar_bloque()
        return SdParseResult(
            materiales=materiales,
            sd_sets=list(sd_sets.values()),
            set_productos=set_productos,
            total_lineas_archivo=total_lineas,
        )

    @staticmethod
    def parse_relaciones_planas(source: Union[str, BinaryIO, io.BytesIO]) -> BomParseResult:
        materiales: Dict[str, MaterialRecord] = {}
        hijos_por_padre: Dict[str, List[BomComponenteDirecto]] = {}
        total_lineas = 0
        padre_actual: Optional[str] = None

        for raw_cols in BomParser._get_row_iterator(source):
            total_lineas += 1
            cols = [str(c).strip() if c is not None else "" for c in raw_cols] + [""] * 5
            padre_raw, hijo_raw, desc, qty_raw, unidad_raw = cols[0], cols[1], cols[2], cols[3], cols[4]

            if padre_raw:
                padre_actual = padre_raw.upper()[:30]
            if not padre_actual or not hijo_raw:
                continue

            hijo = hijo_raw.upper()[:30]
            if hijo == padre_actual:
                continue
            unidad = (unidad_raw or "UN")[:10]
            cantidad = clean_quantity(qty_raw)
            if cantidad <= 0:
                continue

            if padre_actual not in materiales:
                materiales[padre_actual] = MaterialRecord(id_material=padre_actual, nombre=padre_actual, unidad="UN")
            if hijo not in materiales:
                materiales[hijo] = MaterialRecord(id_material=hijo, nombre=(desc or hijo)[:100], unidad=unidad)
            elif desc and materiales[hijo].nombre == hijo:
                materiales[hijo].nombre = desc[:100]

            hijos_por_padre.setdefault(padre_actual, []).append(
                BomComponenteDirecto(id_hijo=hijo, cantidad=cantidad, unidad=unidad)
            )

        return BomParseResult(
            materiales=materiales,
            relaciones=[],
            total_lineas_archivo=total_lineas,
            hijos_por_padre=hijos_por_padre,
        )

    @staticmethod
    def explotar(
        hijos_por_padre: Dict[str, List[BomComponenteDirecto]],
    ) -> Dict[str, Dict[str, Tuple[Decimal, str]]]:
        memo: Dict[str, Dict[str, Tuple[Decimal, str]]] = {}

        def explotar_pieza(pieza: str, en_curso: Set[str]) -> Dict[str, Tuple[Decimal, str]]:
            if pieza in memo:
                return memo[pieza]
            en_curso.add(pieza)
            resultado: Dict[str, Tuple[Decimal, str]] = {}

            def acumular(insumo: str, factor: Decimal, unidad: str) -> None:
                previo = resultado.get(insumo)
                resultado[insumo] = (previo[0] + factor, previo[1]) if previo else (factor, unidad)

            for comp in hijos_por_padre.get(pieza, []):
                acumular(comp.id_hijo, comp.cantidad, comp.unidad)
                if comp.id_hijo in hijos_por_padre and comp.id_hijo not in en_curso:
                    for insumo, (factor, unidad) in explotar_pieza(comp.id_hijo, en_curso).items():
                        acumular(insumo, factor * comp.cantidad, unidad)

            en_curso.discard(pieza)
            memo[pieza] = resultado
            return resultado

        return {pieza: explotar_pieza(pieza, set()) for pieza in hijos_por_padre}

    @staticmethod
    def _get_row_iterator(source: Union[str, BinaryIO, io.BytesIO]) -> Iterator[List[str]]:
        if isinstance(source, str):
            with open(source, "rb") as f:
                header_bytes = f.read(4)
                f.seek(0)
                if header_bytes.startswith(b"PK\x03\x04"):
                    wb = openpyxl.load_workbook(source, read_only=True, data_only=True)
                    ws = wb.active
                    for row in ws.iter_rows(values_only=True):
                        yield [str(c) if c is not None else "" for c in row]
                    wb.close()
                    return

            encodings = ["utf-8", "latin-1", "cp1252"]
            for enc in encodings:
                try:
                    with open(source, mode="r", encoding=enc) as f:
                        reader = csv.reader(f, delimiter="\t")
                        for row in reader:
                            yield row
                    return
                except UnicodeDecodeError:
                    continue
            raise ValueError(f"No se pudo decodificar el archivo {source} con codificaciones estándar.")

        else:
            header_bytes = source.read(4)
            source.seek(0)
            if header_bytes.startswith(b"PK\x03\x04"):
                wb = openpyxl.load_workbook(source, read_only=True, data_only=True)
                ws = wb.active
                for row in ws.iter_rows(values_only=True):
                    yield [str(c) if c is not None else "" for c in row]
                wb.close()
                return

            content = source.read()
            text_data = None
            for enc in ["utf-8", "latin-1", "cp1252"]:
                try:
                    text_data = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue

            if text_data is None:
                raise ValueError("No se pudo decodificar el stream binario.")

            reader = csv.reader(io.StringIO(text_data), delimiter="\t")
            for row in reader:
                yield row
