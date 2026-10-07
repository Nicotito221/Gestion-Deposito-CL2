import io
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber
import pyodbc

from app.core.config import get_db_connection
from app.schemas.ingreso import ParsedInvoiceItem, ParsedInvoiceResult

logger = logging.getLogger(__name__)

DEBUG_DIR = Path(__file__).resolve().parent.parent.parent / "debug_invoices"
DEBUG_DIR.mkdir(exist_ok=True)

STOPWORDS_PO = {
    "DECEMBER", "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER",
    "ORDER", "ORDERS", "TBAR", "TOTAL", "CUSTOMER", "SHIPPER", "DATE",
    "CONFIRMATION", "COMMANDE", "COMMISSIONE", "AUFTRAG", "AUFTRAGSBESTATIGUNG",
}


class InvoiceParserService:
    def __init__(self, connection_factory=get_db_connection) -> None:
        self._get_connection = connection_factory

    def _get_catalog_data(self) -> Dict[str, Any]:
        conn: pyodbc.Connection = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id_proveedor, codigo_proveedor, nombre, pais, ISNULL(deposito_en_planta, 0)
                FROM dbo.proveedor
                WHERE activo = 1
                """
            )
            proveedores = [
                {
                    "id_proveedor": int(r[0]),
                    "codigo_proveedor": str(r[1]).strip() if r[1] else "",
                    "nombre": str(r[2]).strip(),
                    "pais": str(r[3]).strip() if r[3] else "",
                    "deposito_en_planta": bool(r[4]),
                }
                for r in cursor.fetchall()
            ]

            cursor.execute(
                """
                SELECT m.id_material, m.nombre, ISNULL(m.unidad, 'UN'), m.id_proveedor_principal,
                       pm.id_proveedor, pm.codigo_material_proveedor
                FROM dbo.material m
                LEFT JOIN dbo.proveedor_material pm ON m.id_material = pm.id_material AND pm.activo = 1
                WHERE m.activo = 1
                """
            )
            materiales = []
            for r in cursor.fetchall():
                materiales.append({
                    "id_material": str(r[0]).strip(),
                    "nombre": str(r[1]).strip() if r[1] else "",
                    "unidad": str(r[2]).strip() if r[2] else "UN",
                    "id_proveedor_principal": int(r[3]) if r[3] is not None else None,
                    "id_proveedor_pm": int(r[4]) if r[4] is not None else None,
                    "codigo_material_proveedor": str(r[5]).strip() if r[5] else None,
                })

            cursor.execute(
                """
                SELECT rpm.id_proveedor, rpm.id_material, rpm.descripcion, rpm.unidad
                FROM dbo.rundown_parametro_material rpm
                WHERE rpm.activo = 1
                """
            )
            rundown_params = [
                {
                    "id_proveedor": int(r[0]),
                    "id_material": str(r[1]).strip(),
                    "descripcion": str(r[2]).strip() if r[2] else "",
                    "unidad": str(r[3]).strip() if r[3] else "UN",
                }
                for r in cursor.fetchall()
            ]

            return {
                "proveedores": proveedores,
                "materiales": materiales,
                "rundown_params": rundown_params,
            }
        finally:
            cursor.close()
            conn.close()

    def parse_pdf_invoice(self, file_bytes: bytes, filename: str) -> ParsedInvoiceResult:
        full_text_pages: List[str] = []
        tables_pages: List[List[List[Optional[str]]]] = []

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            total_pages = len(pdf.pages)
            for page in pdf.pages:
                text = page.extract_text(layout=False) or page.extract_text() or ""
                full_text_pages.append(text)
                tbls = page.extract_tables() or []
                tables_pages.extend(tbls)

        catalog = self._get_catalog_data()
        all_text = "\n".join(full_text_pages)

        warnings: List[str] = []

        proveedor = self._detect_proveedor(all_text, catalog["proveedores"], filename)
        nro_factura = self._extract_invoice_number(all_text, proveedor, full_text_pages)
        orden_compra = self._extract_purchase_order(all_text, full_text_pages)
        fecha_emision = self._extract_issue_date(all_text)
        items = self._extract_items(all_text, tables_pages, proveedor, catalog, full_text_pages)

        if not proveedor:
            warnings.append("No se pudo detectar el proveedor con total certeza. Verifique la selección manual.")
        if not nro_factura:
            warnings.append("No se identificó el número de factura. Ingréselo manualmente.")
        if not items:
            warnings.append("No se detectaron ítems automáticos o las descripciones no coincidieron con el catálogo.")

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_fname = re.sub(r"[^\w\-.]", "_", filename)
        debug_log_name = f"ocr_{timestamp_str}_{safe_fname}.json"
        debug_log_path = DEBUG_DIR / debug_log_name

        debug_payload = {
            "archivo": filename,
            "timestamp": datetime.now().isoformat(),
            "paginas": total_pages,
            "proveedor_detectado": proveedor,
            "numero_factura": nro_factura,
            "orden_compra": orden_compra,
            "fecha_emision": fecha_emision,
            "items_extraidos": [i.model_dump() for i in items],
            "warnings": warnings,
            "raw_text_sample": all_text[:2000],
        }
        try:
            debug_log_path.write_text(json.dumps(debug_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            logger.warning("No se pudo guardar archivo de depuración OCR: %s", e)

        return ParsedInvoiceResult(
            id_proveedor=proveedor["id_proveedor"] if proveedor else None,
            nombre_proveedor=proveedor["nombre"] if proveedor else None,
            codigo_proveedor=proveedor["codigo_proveedor"] if proveedor else None,
            numero_factura=nro_factura,
            orden_compra=orden_compra,
            fecha_emision=fecha_emision,
            items=items,
            total_paginas=total_pages,
            warnings=warnings,
            debug_log_file=debug_log_name,
        )

    def _detect_proveedor(self, text: str, proveedores: List[Dict[str, Any]], filename: str) -> Optional[Dict[str, Any]]:
        text_upper = (text + " " + filename).upper()

        alias_map = {
            "HOWA": ["HOWA", "HOWA USA", "HOWA TRAMICO"],
            "DOW": ["THE DOW CHEMICAL COMPANY", "DOW CHEMICAL", "DOW"],
            "TAIAN_SANYING": ["TAIAN SANYING", "SANYING NEW MATERIAL", "TAIAN", "MSS FIBERGLASS"],
            "TAIYO_TECHNO": ["TAIYO TECHNO", "TAIYO"],
            "TEXFYT": ["TEXFYT"],
            "TTA": ["TTA"],
            "AHLSTROM_KOREA": ["AHLSTROM KOREA", "AHLSTROM"],
            "TG_CUIR": ["TG CUIR", "TG CUIR INTERNATIONAL", "CUIR INTERNATIONAL"],
        }

        for prov in proveedores:
            cod = prov["codigo_proveedor"].upper()
            nom = prov["nombre"].upper()
            aliases = alias_map.get(cod, [cod, nom])
            for alias in aliases:
                if re.search(r"\b" + re.escape(alias) + r"\b", text_upper):
                    return prov

        for prov in proveedores:
            nom_clean = prov["nombre"].upper().replace("S.A.", "").replace("S.R.L.", "").strip()
            if len(nom_clean) >= 4 and nom_clean in text_upper:
                return prov

        return None

    def _extract_invoice_number(
        self,
        text: str,
        proveedor: Optional[Dict[str, Any]],
        pages: List[str],
    ) -> Optional[str]:
        first_page = pages[0] if pages else text

        is_ahlstrom = proveedor and proveedor.get("codigo_proveedor") == "AHLSTROM_KOREA"
        if not is_ahlstrom and "AHLSTROM" in text.upper():
            is_ahlstrom = True

        if is_ahlstrom:
            m_ahl = re.search(
                r"(?:INVOICE\s*/\s*RECHNUNG|FACTURE\s*/\s*FATTURA)[\s\S]{0,120}?(\d{3}-\d{2}-\d{5})",
                first_page,
                re.I,
            )
            if m_ahl:
                return m_ahl.group(1).strip()

            m_tax = re.search(r"\b(\d{3}-\d{2}-\d{5})\b", first_page)
            if m_tax:
                return m_tax.group(1).strip()

            m_num = re.search(
                r"(?:FACTURE\s*/\s*FATTURA|INVOICE\s*/\s*RECHNUNG)[^\n]*\n\s*([0-9]{3,}[0-9\-]+)",
                first_page,
                re.I,
            )
            if m_num:
                cand = m_num.group(1).strip()
                if cand.upper() not in STOPWORDS_PO and len(cand) >= 4 and not cand.startswith("26KKN"):
                    return cand

            return None

        pats_line = [
            r"INVOICE\s*#\s*[:\s]*([0-9]{8,12}(?:-[0-9A-Z]+)?)",
            r"INVOICE\s*(?:NO\.?|#)\s*[:\s]*([A-Z0-9\-_/]+)",
            r"Factura\s+electr[oó]nica\s+N[°º]?\s*[:\s]*([0-9\-_/]+)",
            r"Factura\s+N[°º]?\s*[:\s]*([0-9\-_/]+)",
            r"Invoice\s+Number\s+Invoice\s+Date[^\n]*\n\s*([0-9]{5,10})",
            r"Invoice\s*[:\s]+([0-9]{8,12})",
        ]

        for pat in pats_line:
            m = re.search(pat, first_page, re.IGNORECASE)
            if m:
                val = m.group(1).strip() if m.groups() else m.group(0).strip()
                val_upper = val.upper()
                if val_upper not in STOPWORDS_PO and len(val) >= 3:
                    return val

        lines = [l.strip() for l in first_page.splitlines() if l.strip()]
        for line in lines:
            m = re.search(r"INVOICE\s*#\s*[:\s]*([A-Z0-9\-_/]+)", line, re.I)
            if m:
                val = m.group(1).strip()
                if val.upper() not in STOPWORDS_PO:
                    return val

        for line in lines:
            m = re.search(r"INVOICE\s*NO\.?\s*[:\s]*([A-Z0-9\-_/]+)", line, re.I)
            if m:
                val = m.group(1).strip()
                if val.upper() not in STOPWORDS_PO:
                    return val

        return None

    def _extract_purchase_order(self, text: str, pages: List[str]) -> Optional[str]:
        first_page = pages[0] if pages else text

        tbar_po_match = re.search(r"\b(5500\d{6})\b", first_page)
        if tbar_po_match:
            return tbar_po_match.group(1)

        lines = [l.strip() for l in first_page.splitlines() if l.strip()]
        for line in lines:
            m = re.search(r"(?:Customer\s+Order\s+Number|CLIENT['’]?S\s+ORDER|Order\s+N[o°]?\.?|Orden\s+de\s+Compra|P\.?O\.?\s*(?:#|NO\.?)?)\s*[:#\s]\s*([A-Z0-9\-_/]+)", line, re.I)
            if m:
                val = m.group(1).strip()
                if val.upper() not in STOPWORDS_PO and not any(sw in val.upper() for sw in STOPWORDS_PO):
                    if len(val) >= 4:
                        return val

        return None

    def _extract_issue_date(self, text: str) -> Optional[str]:
        date_patterns = [
            r"DATE\s*[:\s]*(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})",
            r"DATE\s*[:\s]*(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})",
            r"DATE\s*[:\s]*(\d{1,2})([A-Z]{3})(\d{4})",
            r"DATE\s*[:\s]*([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
            r"(\d{1,2})\s+de\s+([a-zA-Z]+)\s+del?\s+(\d{4})",
            r"(\d{1,2})[/\.](\d{1,2})[/\.](\d{4})",
        ]

        month_map = {
            "JAN": 1, "ENE": 1, "FEB": 2, "MAR": 3, "APR": 4, "ABR": 4,
            "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8, "AGO": 8, "SEP": 9,
            "SET": 9, "OCT": 10, "NOV": 11, "DEC": 12, "DIC": 12,
            "ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4, "MAYO": 5,
            "JUNIO": 6, "JULIO": 7, "AGOSTO": 8, "SEPTIEMBRE": 9, "OCTUBRE": 10,
            "NOVIEMBRE": 11, "DICIEMBRE": 12,
        }

        for pat in date_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                try:
                    if len(groups) == 3:
                        g1, g2, g3 = groups
                        if g2.upper() in month_map:
                            d = int(g1)
                            m = month_map[g2.upper()]
                            y = int(g3)
                            return f"{y:04d}-{m:02d}-{d:02d}"
                        if g1.upper() in month_map:
                            m = month_map[g1.upper()]
                            d = int(g2)
                            y = int(g3)
                            return f"{y:04d}-{m:02d}-{d:02d}"
                        if len(g1) == 4:
                            return f"{int(g1):04d}-{int(g2):02d}-{int(g3):02d}"
                        m_val = int(g1)
                        d_val = int(g2)
                        y_val = int(g3)
                        if m_val > 12 >= d_val:
                            d_val, m_val = m_val, d_val
                        return f"{y_val:04d}-{m_val:02d}-{d_val:02d}"
                except Exception:
                    continue

        return None

    def _extract_items(
        self,
        all_text: str,
        tables: List[List[List[Optional[str]]]],
        proveedor: Optional[Dict[str, Any]],
        catalog: Dict[str, Any],
        pages: List[str],
    ) -> List[ParsedInvoiceItem]:
        items_map: Dict[str, ParsedInvoiceItem] = {}

        candidate_mats: List[Dict[str, Any]] = []
        target_prov_id = proveedor["id_proveedor"] if proveedor else None

        for mat in catalog["materiales"]:
            if target_prov_id:
                if mat["id_proveedor_principal"] == target_prov_id or mat["id_proveedor_pm"] == target_prov_id:
                    candidate_mats.append(mat)
            else:
                candidate_mats.append(mat)

        for rpm in catalog["rundown_params"]:
            if not target_prov_id or rpm["id_proveedor"] == target_prov_id:
                if not any(m["id_material"] == rpm["id_material"] for m in candidate_mats):
                    candidate_mats.append({
                        "id_material": rpm["id_material"],
                        "nombre": rpm["descripcion"],
                        "unidad": rpm["unidad"],
                        "id_proveedor_principal": rpm["id_proveedor"],
                        "id_proveedor_pm": None,
                        "codigo_material_proveedor": None,
                    })

        for table in tables:
            headers = None
            for r_idx in range(min(3, len(table))):
                row_txt = " ".join(str(c or "") for c in table[r_idx]).upper()
                if "QUANTITY" in row_txt or "METER" in row_txt or "GOODS" in row_txt or "DESCRIPTION" in row_txt or "H.S" in row_txt:
                    headers = table[r_idx]
                    break
            if not headers and table:
                headers = table[0]

            for row in table[1:]:
                if not row or len(row) < 3:
                    continue
                row_str = " ".join(str(cell) for cell in row if cell)
                for mat in candidate_mats:
                    mat_id = mat["id_material"]
                    tokens = [mat_id]
                    if mat.get("codigo_material_proveedor"):
                        tokens.append(mat["codigo_material_proveedor"])
                    if "EMC100" in mat.get("nombre", ""):
                        if "1450" in mat.get("nombre", ""):
                            tokens.extend(["EMC100g-1450mm", "EMC100-1450"])
                        elif "1510" in mat.get("nombre", ""):
                            tokens.extend(["EMC100g-1510mm", "EMC100-1510"])
                    elif "EMC150" in mat.get("nombre", ""):
                        if "750" in mat.get("nombre", ""):
                            tokens.extend(["EMC150g-750mm", "EMC150-750"])
                        elif "1510" in mat.get("nombre", ""):
                            tokens.extend(["EMC150g-1510mm", "EMC150-1510"])

                    if any(t.upper() in row_str.upper() for t in tokens if t):
                        qty = self._find_qty_in_table_row(row, tokens, headers)
                        if qty and qty > 0:
                            items_map[mat_id] = ParsedInvoiceItem(
                                id_material=mat_id,
                                nombre_material=mat["nombre"],
                                unidad=mat["unidad"],
                                cantidad_facturada=qty,
                                confidence=0.98 if hasattr(ParsedInvoiceItem, "confidence") else 0.98,
                                confianza=0.98,
                                linea_origen=row_str,
                            )

        for p_idx, page_text in enumerate(pages):
            lines = [l.strip() for l in page_text.splitlines() if l.strip()]
            for mat in candidate_mats:
                mat_id = mat["id_material"]
                if mat_id in items_map:
                    continue

                tokens = [mat_id]
                if mat.get("codigo_material_proveedor"):
                    tokens.append(mat["codigo_material_proveedor"])

                if "EMC100" in mat.get("nombre", ""):
                    if "1450" in mat.get("nombre", ""):
                        tokens.extend(["EMC100g-1450mm", "EMC100-1450"])
                    elif "1510" in mat.get("nombre", ""):
                        tokens.extend(["EMC100g-1510mm", "EMC100-1510"])
                elif "EMC150" in mat.get("nombre", ""):
                    if "750" in mat.get("nombre", ""):
                        tokens.extend(["EMC150g-750mm", "EMC150-750"])
                    elif "1510" in mat.get("nombre", ""):
                        tokens.extend(["EMC150g-1510mm", "EMC150-1510"])

                for line_idx, line in enumerate(lines):
                    if any(t.upper() in line.upper() for t in tokens if t):
                        qty_tuple = self._parse_quantity_and_unit_around_line(lines, line_idx, tokens)
                        if qty_tuple:
                            raw_qty, detected_unit = qty_tuple
                            converted_qty = self._convert_quantity_to_target_unit(raw_qty, detected_unit, mat["unidad"])
                            if converted_qty and converted_qty > 0:
                                items_map[mat_id] = ParsedInvoiceItem(
                                    id_material=mat_id,
                                    nombre_material=mat["nombre"],
                                    unidad=mat["unidad"],
                                    cantidad_facturada=converted_qty,
                                    confianza=0.95,
                                    linea_origen=line,
                                )
                                break

        return list(items_map.values())

    def _convert_quantity_to_target_unit(self, qty: float, source_unit: Optional[str], target_unit: str) -> float:
        if not source_unit:
            return round(qty, 2)
        s = source_unit.strip().upper()
        t = target_unit.strip().upper()

        if s == t:
            return round(qty, 2)

        if s in ("KG", "KGS", "KILO", "KILOS") and t in ("G", "GR", "GRS", "GRAMO", "GRAMOS"):
            return round(qty * 1000.0, 2)

        if s in ("G", "GR", "GRS", "GRAMO", "GRAMOS") and t in ("KG", "KGS", "KILO", "KILOS"):
            return round(qty / 1000.0, 3)

        if s in ("M", "MTS", "METROS", "MTR") and t in ("MM", "MILIMETROS"):
            return round(qty * 1000.0, 2)

        return round(qty, 2)

    def _find_qty_in_table_row(
        self,
        row: List[Optional[str]],
        tokens: List[str],
        table_headers: Optional[List[Optional[str]]] = None,
    ) -> Optional[float]:
        if table_headers:
            for idx, h in enumerate(table_headers):
                h_str = str(h or "").upper()
                if ("LINEAR" in h_str or "METER" in h_str or "METROS" in h_str) and idx < len(row):
                    cell_val = row[idx]
                    if cell_val:
                        num = self._clean_number(str(cell_val))
                        if num and num > 0 and num != 701915:
                            return num

            for idx, h in enumerate(table_headers):
                h_str = str(h or "").upper()
                is_qty_col = any(k in h_str for k in ("QTY", "QUANTITY", "CANTIDAD", "CANT", "MENGE", "QUANTITE"))
                is_excluded = any(k in h_str for k in ("PRICE", "PRECIO", "TOTAL", "AMOUNT", "UNIT", "ITEM", "POS", "#", "NO."))
                if is_qty_col and not is_excluded and idx < len(row):
                    cell_val = row[idx]
                    if cell_val:
                        num = self._clean_number(str(cell_val))
                        if num and num > 0 and num != 701915:
                            return num

        mat_cell_idx = -1
        for idx, cell in enumerate(row):
            if cell and any(t.upper() in str(cell).upper() for t in tokens if t):
                mat_cell_idx = idx
                break

        candidate_nums = []
        for idx, cell in enumerate(row):
            if not cell:
                continue
            if mat_cell_idx >= 0 and idx <= mat_cell_idx:
                continue

            c_str = str(cell).strip()
            if any(t.upper() in c_str.upper() for t in tokens if t):
                continue

            digits_only = re.sub(r"\D", "", c_str)
            if digits_only.startswith("7019") or c_str in ("701915", "701910", "701990"):
                continue

            if "$" in c_str or "USD" in c_str.upper() or "EUR" in c_str.upper():
                continue

            num = self._clean_number(c_str)
            if num is not None and num > 0 and num != 701915:
                if num < 10 and "." in str(cell):
                    continue
                candidate_nums.append(num)

        if not candidate_nums:
            for idx, cell in enumerate(row):
                if not cell:
                    continue
                c_str = str(cell).strip()
                if any(t.upper() in c_str.upper() for t in tokens if t):
                    continue
                digits_only = re.sub(r"\D", "", c_str)
                if digits_only.startswith("7019") or c_str in ("701915", "701910", "701990"):
                    continue
                if "$" in c_str or "USD" in c_str.upper() or "EUR" in c_str.upper():
                    continue
                num = self._clean_number(c_str)
                if num is not None and num > 0 and num != 701915:
                    if num < 10 and "." in str(cell):
                        continue
                    if idx == 0 and num.is_integer() and 1 <= num <= 50 and len(row) > 2:
                        continue
                    candidate_nums.append(num)

        if not candidate_nums:
            return None

        if len(candidate_nums) >= 2 and candidate_nums[0] < 500 and candidate_nums[1] >= 500:
            return candidate_nums[1]

        return candidate_nums[0]

    def _parse_quantity_and_unit_around_line(
        self, lines: List[str], target_idx: int, tokens: List[str]
    ) -> Optional[Tuple[float, Optional[str]]]:
        search_lines = []
        start_idx = max(0, target_idx - 3)
        end_idx = min(len(lines), target_idx + 4)
        for i in range(start_idx, end_idx):
            search_lines.append(lines[i])

        for line in search_lines:
            dow_price_qty = re.search(r"([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)\s*KG\s+[0-9,.]+\s+[0-9,.]+", line, re.I)
            if dow_price_qty:
                n = self._clean_number(dow_price_qty.group(1))
                if n and n > 0:
                    return n, "KG"

        for line in search_lines:
            weight_match = re.search(r"(?:Net\s+Weight\s*[:\s]*|Quantity\s+in\s+Price\s+Unit[^\d]*)([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)\s*(KG|M2|UNI|MTS|G)?", line, re.I)
            if weight_match:
                n = self._clean_number(weight_match.group(1))
                u = weight_match.group(2) if len(weight_match.groups()) >= 2 else None
                if n and n > 0:
                    return n, u

        for line in search_lines:
            kg_match = re.search(r"([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)\s*KG", line, re.I)
            if kg_match:
                n = self._clean_number(kg_match.group(1))
                if n and n > 0:
                    return n, "KG"

            m2_match = re.search(r"([0-9]{3,9})\s*M2", line, re.I)
            if m2_match:
                n = self._clean_number(m2_match.group(1))
                if n and n > 0:
                    return n, "M2"

        cleaned = lines[target_idx]
        for t in tokens:
            cleaned = cleaned.replace(t, " ")
        cleaned = re.sub(r"^\s*[0-9]{1,3}\b", " ", cleaned)
        cleaned = re.sub(r"\$[0-9,.]+", " ", cleaned)
        cleaned = re.sub(r"\b(?:USD|EUR|ARS|\$|KG|MTS|M2|UNI|Tote|ROLLS|ROLL)\b", " ", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\b7019\d{2}\b", " ", cleaned)

        num_matches = re.findall(r"(?:\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+)", cleaned)
        valid_nums = []
        for n_str in num_matches:
            val = self._clean_number(n_str)
            if val is not None and val > 0 and val != 701915:
                if val < 10 and "." in n_str:
                    continue
                valid_nums.append(val)

        if len(valid_nums) >= 2 and valid_nums[0] < 500 and valid_nums[1] >= 500:
            return valid_nums[1], None

        if valid_nums:
            return valid_nums[0], None

        return None

    def _clean_number(self, val_str: str) -> Optional[float]:
        s = val_str.strip()
        if not s:
            return None
        if "." in s and "," in s:
            if s.rfind(".") > s.rfind(","):
                s = s.replace(",", "")
            else:
                s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            parts = s.split(",")
            if len(parts) == 2 and len(parts[1]) in (1, 2, 3, 4):
                s = s.replace(",", ".")
            else:
                s = s.replace(",", "")

        try:
            return float(s)
        except ValueError:
            return None
