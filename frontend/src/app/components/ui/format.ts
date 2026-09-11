const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [datePart, timePart] = dateStr.split(" ");
  const parts = datePart.split("/");
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const month = MONTHS[monthIdx] ?? "";
  return timePart ? `${day} ${month} · ${timePart}` : `${day} ${month}`;
}

export function formatNow(): string {
  const now = new Date();
  const day = now.getDate();
  const month = MONTHS[now.getMonth()];
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${day} ${month} · ${h}:${m}`;
}

export function formatDateLong(): string {
  const now = new Date();
  return now.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
