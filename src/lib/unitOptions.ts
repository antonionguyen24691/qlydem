import { getAuthHeaders } from "./supabase";

export type UnitOption = { code: string; name: string };

export const defaultUnitOptions: UnitOption[] = [
  { code: "HỘP", name: "Hộp" },
  { code: "VIÊN", name: "Viên" },
  { code: "M2", name: "Mét vuông" }
];

export async function loadUnitOptions() {
  const response = await fetch("/api/settings?key=units", { headers: await getAuthHeaders() });
  if (!response.ok) throw new Error("Không tải được danh sách đơn vị tính.");
  const body = await response.json();
  const units = Array.isArray(body?.units?.units) ? body.units.units : [];
  const normalized = units
    .map((unit: any) => ({
      code: String(unit.code ?? "").trim(),
      name: String(unit.name ?? unit.code ?? "").trim()
    }))
    .filter((unit: UnitOption) => unit.code && unit.name);
  return normalized.length > 0 ? normalized : defaultUnitOptions;
}
