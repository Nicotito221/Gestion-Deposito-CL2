export function normalizarTermino(texto: string): string {
  return texto.trim().toLowerCase();
}

function compactar(texto: string): string {
  return texto.toLowerCase().replace(/[\s-]+/g, "");
}

export function coincideTexto(valor: string | null | undefined, termino: string): boolean {
  if (!termino) return true;
  return Boolean(valor) && String(valor).toLowerCase().includes(termino);
}

export function coincideCodigo(valor: string | null | undefined, termino: string): boolean {
  if (!termino) return true;
  if (!valor) return false;
  const texto = String(valor);
  if (texto.toLowerCase().includes(termino)) return true;
  const terminoCompacto = compactar(termino);
  return terminoCompacto.length > 0 && compactar(texto).includes(terminoCompacto);
}

export function coincideNumero(valor: number, termino: string): boolean {
  const limpio = termino.replace(/^#/, "").replace(/^0+(?=\d)/, "");
  return limpio.length > 0 && /^\d+$/.test(limpio) && String(valor).includes(limpio);
}
