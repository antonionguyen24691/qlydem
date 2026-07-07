import { useMemo, useState } from "react";
import { Database, Download, KeyRound, Upload } from "lucide-react";
import { useAuthStore } from "../store/auth";

const importTargets = [
  {
    entity: "customers",
    title: "Khách hàng",
    description: "Upload danh sách khách hàng, hạn mức nợ, nợ đầu kỳ và thông tin liên hệ."
  },
  {
    entity: "suppliers",
    title: "Nhà cung cấp",
    description: "Upload nhà cung cấp, điều khoản thanh toán và công nợ phải trả đầu kỳ."
  },
  {
    entity: "products",
    title: "Hàng hóa",
    description: "Upload mã hàng, nguyên liệu, bán thành phẩm, thành phẩm, hàng hóa, giá và trạng thái."
  }
] as const;

type ImportResult = {
  ok: boolean;
  batchId?: string;
  totalRows?: number;
  successRows?: number;
  failedRows?: number;
  error?: string;
};

export function Settings() {
  const { secret, setSecret } = useAuthStore();
  const [uploading, setUploading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ImportResult>>({});

  const canUpload = useMemo(() => secret.trim().length > 0, [secret]);

  const downloadTemplate = (entity: string) => {
    window.open(`/api/templates/${entity}`, "_blank");
  };

  const uploadFile = async (entity: string, file?: File) => {
    if (!file || !canUpload) return;
    setUploading(entity);
    setResults((current) => ({ ...current, [entity]: { ok: true } }));

    try {
      const response = await fetch(`/api/import/${entity}`, {
        method: "POST",
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-file-name": file.name,
          "x-internal-secret": secret
        },
        body: await file.arrayBuffer()
      });
      const body = await response.json();
      setResults((current) => ({ ...current, [entity]: body }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [entity]: {
          ok: false,
          error: error instanceof Error ? error.message : "Upload thất bại"
        }
      }));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cấu hình hệ thống</h1>
        <p className="mt-1 text-sm text-gray-500">
          Khu vực bootstrap dữ liệu ban đầu: tải file mẫu, nhập dữ liệu và upload vào Supabase.
        </p>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-[#006B68]/10 p-2 text-[#006B68]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-sm font-medium text-gray-900">Internal API Secret</label>
            <p className="mt-1 text-sm text-gray-500">
              Dùng tạm cho giai đoạn bootstrap trước khi có login/RBAC hoàn chỉnh.
            </p>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Nhập INTERNAL_API_SECRET"
              className="mt-3 w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#006B68] focus:ring-1 focus:ring-[#006B68]"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {importTargets.map((target) => {
          const result = results[target.entity];
          return (
            <section key={target.entity} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-md bg-gray-100 p-2 text-gray-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{target.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{target.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => downloadTemplate(target.entity)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  Tải file mẫu
                </button>

                <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white ${canUpload ? "bg-[#006B68] hover:bg-[#005a57]" : "bg-gray-300"}`}>
                  <Upload className="h-4 w-4" />
                  {uploading === target.entity ? "Đang upload..." : "Upload file"}
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={!canUpload || uploading === target.entity}
                    className="hidden"
                    onChange={(event) => uploadFile(target.entity, event.target.files?.[0])}
                  />
                </label>
              </div>

              {result && (
                <div className={`mt-4 rounded-md p-3 text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  {result.error ? (
                    <div>{result.error}</div>
                  ) : (
                    <div>
                      <div>Batch: {result.batchId ?? "-"}</div>
                      <div>Tổng dòng: {result.totalRows ?? 0}</div>
                      <div>Thành công: {result.successRows ?? 0}</div>
                      <div>Lỗi: {result.failedRows ?? 0}</div>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
