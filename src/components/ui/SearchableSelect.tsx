import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "../../lib/utils";

export type SearchableOption = { value: string; label: string; description?: string };

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
};

export function SearchableSelect({ value, onChange, options, placeholder, searchPlaceholder = "Tìm kiếm...", emptyText = "Không tìm thấy kết quả", disabled, required }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    return normalized ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalized)) : options;
  }, [options, term]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input type="hidden" value={value} required={required} readOnly />
      <button type="button" disabled={disabled} onClick={() => setOpen((current) => !current)} className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-[16px] focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:h-10 sm:text-sm">
        <span className={cn("truncate", selected ? "text-zinc-900" : "text-zinc-500")}>{selected?.label ?? placeholder}</span>
        <Search className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
          <div className="border-b border-zinc-100 p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder={searchPlaceholder} className="h-9 w-full rounded-md border border-zinc-200 pl-8 pr-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.length === 0 && <div className="px-3 py-4 text-center text-sm text-zinc-500">{emptyText}</div>}
            {filteredOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); setTerm(""); }} className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50">
                <span className="min-w-0"><span className="block truncate font-medium text-zinc-900">{option.label}</span>{option.description && <span className="block truncate text-xs text-zinc-500">{option.description}</span>}</span>
                {value === option.value && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
