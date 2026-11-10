import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { es } from "date-fns/locale";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";

interface DateInputChangeEvent {
  target: { value: string };
}

interface DateInputARProps {
  value: string;
  onChange: (e: DateInputChangeEvent) => void;
  min?: string;
  max?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

function isoADisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function isoAFecha(iso: string | undefined): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

function fechaAIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayAIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return fechaAIso(d);
}

function enmascarar(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function DateInputAR({ value, onChange, min, max, id, disabled, className }: DateInputARProps) {
  const [texto, setTexto] = useState<string>(isoADisplay(value));
  const [abierto, setAbierto] = useState<boolean>(false);

  useEffect(() => {
    setTexto(isoADisplay(value));
  }, [value]);

  const fueraDeRango = (iso: string): boolean => Boolean((min && iso < min) || (max && iso > max));

  const emitir = (iso: string) => {
    if (fueraDeRango(iso)) {
      setTexto(isoADisplay(value));
      return;
    }
    onChange({ target: { value: iso } });
  };

  const minDate = isoAFecha(min);
  const maxDate = isoAFecha(max);

  return (
    <div className={cn("relative inline-flex items-center w-full", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        disabled={disabled}
        value={texto}
        onChange={(e) => {
          const nuevo = enmascarar(e.target.value);
          setTexto(nuevo);
          if (nuevo === "") {
            if (value) onChange({ target: { value: "" } });
            return;
          }
          const iso = displayAIso(nuevo);
          if (iso && !fueraDeRango(iso)) onChange({ target: { value: iso } });
        }}
        onBlur={() => {
          if (texto === "") return;
          const iso = displayAIso(texto);
          if (!iso || fueraDeRango(iso)) setTexto(isoADisplay(value));
        }}
        className={cn(
          "placeholder:text-muted-foreground border-input bg-input-background flex h-9 min-w-0 rounded-md border px-3 py-1 text-base md:text-sm transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className,
          "w-full max-w-none flex-1 pr-8"
        )}
      />
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-1.5 p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-50"
            aria-label="Abrir calendario"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={es}
            weekStartsOn={1}
            selected={isoAFecha(value)}
            defaultMonth={isoAFecha(value)}
            fromDate={minDate}
            toDate={maxDate}
            onSelect={(d) => {
              if (d) {
                emitir(fechaAIso(d));
                setAbierto(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
