import type { ApiRequest, ApiResponse } from "../_lib/http.js";
import { getQueryValue, methodNotAllowed, sendError } from "../_lib/http.js";
import { requireAuth, requirePermission } from "../_lib/auth.js";
import { getJsonBody, toStringValue } from "../_lib/body.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { getEntitlementSnapshot } from "../_lib/entitlements.js";
import { enforceRateLimit } from "../_lib/rateLimit.js";

type BrandingSettings = {
  appName: string;
  companyName: string;
  appDescription: string;
  address: string;
  hotline: string;
  taxCode: string;
  logoUrl: string;
  faviconUrl: string;
};

type PaymentSettings = {
  enabled: boolean;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferTemplate: string;
};

type UnitSettings = {
  units: Array<{
    code: string;
    name: string;
    baseCode?: string;
    factor?: number;
  }>;
};

type InventoryOperationSettings = {
  operations: Array<{
    code: string;
    name: string;
    direction: "IN" | "OUT" | "COUNT";
    costingMethod?: "WEIGHTED_AVERAGE" | "FIFO" | "LOT";
  }>;
};

const defaultBranding: BrandingSettings = {
  appName: "PMQL",
  companyName: "PMQL",
  appDescription: "Phần mềm quản lý bán hàng",
  address: "",
  hotline: "",
  taxCode: "",
  logoUrl: "",
  faviconUrl: ""
};

const defaultPayment: PaymentSettings = {
  enabled: false,
  bankBin: "",
  accountNumber: "",
  accountName: "",
  transferTemplate: "Thanh toan {orderCode}"
};

const defaultUnits: UnitSettings = {
  units: [
    { code: "HỘP", name: "Hộp", factor: 1 },
    { code: "VIÊN", name: "Viên", baseCode: "HỘP", factor: 1 },
    { code: "M2", name: "Mét vuông", baseCode: "HỘP", factor: 1 }
  ]
};

type ExpenseCategorySettings = {
  categories: Array<{
    code: string;
    name: string;
  }>;
};

const defaultExpenseCategories: ExpenseCategorySettings = {
  categories: [
    { code: "FUEL", name: "Xăng xe" },
    { code: "TRANSPORT", name: "Vận tải" },
    { code: "LABOR", name: "Nhân công" },
    { code: "UTILITY", name: "Điện nước" },
    { code: "RENT", name: "Thuê mặt bằng" },
    { code: "OTHER", name: "Chi phí khác" }
  ]
};

const defaultInventoryOperations: InventoryOperationSettings = {
  operations: [
    { code: "PURCHASE_IN", name: "Nhập mua hàng", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "RETURN_IN", name: "Nhập hàng trả lại", direction: "IN", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "SALE_OUT", name: "Xuất bán hàng", direction: "OUT", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "DAMAGE_OUT", name: "Xuất hao hụt/hư hỏng", direction: "OUT", costingMethod: "WEIGHTED_AVERAGE" },
    { code: "STOCK_COUNT", name: "Kiểm kê điều chỉnh", direction: "COUNT", costingMethod: "WEIGHTED_AVERAGE" }
  ]
};

type AppearanceSettings = {
  themeId: "classic" | "moss" | "terracotta";
};

const defaultAppearance: AppearanceSettings = { themeId: "classic" };

function setHealthHeaders(res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
}

async function respondHealth(res: ApiResponse) {
  setHealthHeaders(res);
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const hasGoogleSheetsConfig = Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  const hasScheduledBackupConfig = hasGoogleSheetsConfig && Boolean(process.env.CRON_SECRET);

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("settings").select("key", { head: true }).limit(1);
    if (error) throw error;
    res.status(200).json({
      ok: true,
      status: "ready",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      checks: {
        database: "ready",
        googleSheetsBackup: hasGoogleSheetsConfig ? "configured" : "not_configured",
        scheduledGoogleSheetsBackup: hasScheduledBackupConfig ? "configured" : "not_configured"
      },
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? null
    });
  } catch {
    res.status(503).json({
      ok: false,
      status: "degraded",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      checks: {
        database: "unavailable",
        googleSheetsBackup: hasGoogleSheetsConfig ? "configured" : "not_configured",
        scheduledGoogleSheetsBackup: hasScheduledBackupConfig ? "configured" : "not_configured"
      }
    });
  }
}

function normalizeAppearance(input: Record<string, unknown>): AppearanceSettings {
  const themeId = toStringValue(input.themeId, defaultAppearance.themeId).trim();
  return {
    themeId: ["classic", "moss", "terracotta"].includes(themeId)
      ? (themeId as AppearanceSettings["themeId"])
      : defaultAppearance.themeId
  };
}

// Chỉ chấp nhận ảnh https hoặc data URI ảnh; loại bỏ javascript:/http:/URL lạ để tránh SSRF/lộ IP khi in bill.
function safeImageUrl(value: unknown) {
  const url = toStringValue(value).trim();
  if (!url) return "";
  if (/^https:\/\//i.test(url)) return url;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(url)) return url;
  return "";
}

function normalizeBranding(input: Record<string, unknown>): BrandingSettings {
  return {
    appName: toStringValue(input.appName, defaultBranding.appName).trim() || defaultBranding.appName,
    companyName: toStringValue(input.companyName, defaultBranding.companyName).trim() || defaultBranding.companyName,
    appDescription: toStringValue(input.appDescription, defaultBranding.appDescription).trim() || defaultBranding.appDescription,
    address: toStringValue(input.address).trim(),
    hotline: toStringValue(input.hotline).trim(),
    taxCode: toStringValue(input.taxCode).trim(),
    logoUrl: safeImageUrl(input.logoUrl),
    faviconUrl: safeImageUrl(input.faviconUrl)
  };
}

function normalizePayment(input: Record<string, unknown>): PaymentSettings {
  return {
    enabled: Boolean(input.enabled),
    bankBin: toStringValue(input.bankBin).trim(),
    accountNumber: toStringValue(input.accountNumber).trim(),
    accountName: toStringValue(input.accountName).trim(),
    transferTemplate: toStringValue(input.transferTemplate, defaultPayment.transferTemplate).trim() || defaultPayment.transferTemplate
  };
}

function normalizeUnits(input: Record<string, unknown>): UnitSettings {
  const rawUnits = Array.isArray(input.units) ? input.units : defaultUnits.units;
  const units = rawUnits
    .map((item) => {
      const row = item as Record<string, unknown>;
      const code = toStringValue(row.code).trim().toUpperCase();
      return {
        code,
        name: toStringValue(row.name, code).trim() || code,
        baseCode: toStringValue(row.baseCode).trim().toUpperCase() || undefined,
        factor: Number(row.factor ?? 1) || 1
      };
    })
    .filter((item) => item.code);
  return { units: units.length > 0 ? units : defaultUnits.units };
}

function normalizeInventoryOperations(input: Record<string, unknown>): InventoryOperationSettings {
  const rawOperations = Array.isArray(input.operations) ? input.operations : defaultInventoryOperations.operations;
  const operations = rawOperations
    .map((item) => {
      const row = item as Record<string, unknown>;
      const direction = toStringValue(row.direction, "IN").trim().toUpperCase();
      const costingMethod = toStringValue(row.costingMethod, "WEIGHTED_AVERAGE").trim().toUpperCase();
      return {
        code: toStringValue(row.code).trim().toUpperCase(),
        name: toStringValue(row.name).trim(),
        direction: ["IN", "OUT", "COUNT"].includes(direction) ? direction as "IN" | "OUT" | "COUNT" : "IN",
        costingMethod: ["WEIGHTED_AVERAGE", "FIFO", "LOT"].includes(costingMethod) ? costingMethod as "WEIGHTED_AVERAGE" | "FIFO" | "LOT" : "WEIGHTED_AVERAGE"
      };
    })
    .filter((item) => item.code && item.name);
  return { operations: operations.length > 0 ? operations : defaultInventoryOperations.operations };
}

function normalizeExpenseCategories(input: Record<string, unknown>): ExpenseCategorySettings {
  const rawCategories = Array.isArray(input.categories) ? input.categories : defaultExpenseCategories.categories;
  const categories = rawCategories
    .map((item) => {
      const row = item as Record<string, unknown>;
      const code = toStringValue(row.code).trim().toUpperCase();
      return {
        code,
        name: toStringValue(row.name, code).trim() || code
      };
    })
    .filter((item) => item.code);
  return { categories: categories.length > 0 ? categories : defaultExpenseCategories.categories };
}

function normalizeSetting(key: string, input: Record<string, unknown>) {
  if (key === "branding") return normalizeBranding(input);
  if (key === "payment") return normalizePayment(input);
  if (key === "inventoryOperations") return normalizeInventoryOperations(input);
  if (key === "expenseCategories") return normalizeExpenseCategories(input);
  if (key === "appearance") return normalizeAppearance(input);
  return normalizeUnits(input);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const key = getQueryValue(req.query?.key) ?? "branding";
    if (!["branding", "payment", "units", "inventoryOperations", "expenseCategories", "appearance", "entitlements", "health"].includes(key)) {
      res.status(400).json({ ok: false, error: "Unsupported settings key." });
      return;
    }

    if (req.method === "GET") {
      if (key === "health") {
        await respondHealth(res);
        return;
      }
      if (key === "entitlements") {
        const actor = await requireAuth(req);
        const snapshot = await getEntitlementSnapshot(actor.id);
        res.status(200).json({ ok: true, ...snapshot });
        return;
      }

      if (key !== "branding" && key !== "appearance") {
        await requireAuth(req);
      } else {
        // branding/appearance không cần đăng nhập (màn login cũng cần đọc) — giới hạn nhẹ chống dò/spam.
        enforceRateLimit(req, "settings-public-get", 30, 60_000);
      }
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        if (error) throw new Error(error.message);
        const value = (data?.value as Record<string, unknown>) ?? {};
        res.status(200).json({
          ok: true,
          branding: key === "branding" ? normalizeBranding(value) : undefined,
          payment: key === "payment" ? normalizePayment(value) : undefined,
          units: key === "units" ? normalizeUnits(value) : undefined,
          inventoryOperations: key === "inventoryOperations" ? normalizeInventoryOperations(value) : undefined,
          expenseCategories: key === "expenseCategories" ? normalizeExpenseCategories(value) : undefined,
          appearance: key === "appearance" ? normalizeAppearance(value) : undefined
        });
      } catch (error) {
        res.status(200).json({
          ok: true,
          branding: key === "branding" ? defaultBranding : undefined,
          payment: key === "payment" ? defaultPayment : undefined,
          units: key === "units" ? defaultUnits : undefined,
          inventoryOperations: key === "inventoryOperations" ? defaultInventoryOperations : undefined,
          expenseCategories: key === "expenseCategories" ? defaultExpenseCategories : undefined,
          appearance: key === "appearance" ? defaultAppearance : undefined,
          warning: error instanceof Error ? error.message : "Không đọc được cấu hình Supabase."
        });
      }
      return;
    }

    if (key === "health") return methodNotAllowed(res, ["GET"]);

    if (req.method === "POST") {
      const actor = await requirePermission(req, "settings.manage");
      const supabase = getSupabaseAdmin();
      const payload = normalizeSetting(key, getJsonBody(req));
      const { data, error } = await supabase
        .from("settings")
        .upsert({
          key,
          value: payload,
          updated_by: actor.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "key" })
        .select("value")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("audit_logs").insert({
        actor_id: actor.id,
        action: "UPDATE",
        entity_type: "settings",
        entity_id: key,
        after_json: data?.value ?? payload
      });

      const value = (data?.value as Record<string, unknown>) ?? payload;
      res.status(200).json({
        ok: true,
        branding: key === "branding" ? normalizeBranding(value) : undefined,
        payment: key === "payment" ? normalizePayment(value) : undefined,
        units: key === "units" ? normalizeUnits(value) : undefined,
        inventoryOperations: key === "inventoryOperations" ? normalizeInventoryOperations(value) : undefined,
        expenseCategories: key === "expenseCategories" ? normalizeExpenseCategories(value) : undefined,
        appearance: key === "appearance" ? normalizeAppearance(value) : undefined
      });
      return;
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    sendError(res, error);
  }
}
