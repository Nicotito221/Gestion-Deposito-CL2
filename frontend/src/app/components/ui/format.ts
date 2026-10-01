export const TIMEZONE_AR = "America/Argentina/Buenos_Aires";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function getTodayISODate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getYesterdayISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

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
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_AR,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";

  return `${day} ${month} · ${hour}:${minute}`;
}

export function formatDateLong(): string {
  return new Date().toLocaleDateString("es-AR", {
    timeZone: TIMEZONE_AR,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatSoloFechaAR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const monthIdx = parseInt(m, 10) - 1;
    const month = MONTHS[monthIdx] ?? m;
    return `${parseInt(d, 10)} ${month} ${y}`;
  }
  return dateStr;
}

export function formatFechaHoraAR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("es-AR", {
    timeZone: TIMEZONE_AR,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getTurnoSugeridoActual(): "Turno Mañana" | "Turno Tarde" | "Completo" {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIMEZONE_AR,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const totalMinutes = hour * 60 + minute;

  if (totalMinutes >= 360 && totalMinutes <= 840) {
    return "Turno Mañana";
  } else if (totalMinutes > 840 && totalMinutes < 1380) {
    return "Turno Tarde";
  }
  return "Completo";
}
