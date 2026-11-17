"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { browserApiClient } from "@/lib/client-api";

const SAMPLE_CSV = [
  "externalProductId,merchantName,merchantWebsite,title,brandName,ean,mpn,price,shippingCost,currency,availabilityStatus,condition,productUrl,sourceUpdatedAt",
  "CSV-LIVE-1,Power Buy (Demo),https://www.powerbuy.co.th,Apple iPhone 16 Pro 256GB Natural Titanium,Apple,0195949821943,MYN13TH/A,38500.00,0,THB,in_stock,new,https://www.powerbuy.co.th/th/product/ip16pro-256-demo,2026-11-17T08:00:00Z",
  "CSV-LIVE-2,JIB Computer Group (Demo),https://www.jib.co.th,Sony WH-1000XM5 Wireless Headphones Black (ไม่ระบุ EAN/MPN),Sony,,,10490.00,45.00,THB,in_stock,new,https://www.jib.co.th/web/product/xm5-black-demo,2026-11-17T08:00:00Z",
].join("\n");

export default function AdminDataSourcesPage() {
  const queryClient = useQueryClient();
  const sourcesQuery = useQuery({
    queryKey: ["admin-data-sources"],
    queryFn: async () => (await browserApiClient.getDataSources()).data,
  });

  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [csvContent, setCsvContent] = useState(SAMPLE_CSV);
  const [importResult, setImportResult] = useState<{
    jobId: string;
    status: string;
    recordsProcessed: number;
    recordsFailed: number;
    autoMatchedCount: number;
    queuedForReviewCount: number;
    snapshotsRecorded: number;
    alertsTriggered: number;
    errors: string[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const sources = sourcesQuery.data ?? [];
  const effectiveSourceId = selectedSourceId || sources[0]?.id || "";

  async function handleRunCsvImport(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setImportResult(null);
    if (!effectiveSourceId) {
      setErrorMsg("ไม่พบแหล่งข้อมูลสำหรับนำเข้า");
      return;
    }

    setRunning(true);
    try {
      const res = await browserApiClient.importCsvOffers(
        effectiveSourceId,
        csvContent,
      );
      setImportResult(res.data);
      await queryClient.invalidateQueries({ queryKey: ["admin-ingestion-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-data-quality"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-match-candidates"] });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า CSV",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* CSV Offer Ingestion Tool */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <UploadCloud className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <span>นำเข้าข้อเสนอราคาด้วยไฟล์ CSV (Idempotent 10-Step Ingestion Pipeline)</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          ระบบจะตรวจสอบข้อมูลด้วย Zod, คำนวณราคารวมส่งเฉพาะเมื่อทราบค่าส่ง, จับคู่สินค้าด้วย GTIN/EAN/MPN อัตโนมัติ และส่งรายการที่ไม่แน่ใจเข้าคิวตรวจสอบ
        </p>

        <form
          onSubmit={(e) => void handleRunCsvImport(e)}
          className="mt-4 space-y-4"
        >
          <div>
            <label
              htmlFor="source-select"
              className="block text-xs font-semibold text-slate-700"
            >
              เลือกแหล่งข้อมูล (Data Source)
            </label>
            <select
              id="source-select"
              value={effectiveSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sourceType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="csv-textarea"
              className="block text-xs font-semibold text-slate-700"
            >
              ข้อมูล CSV (บรรทัดที่ 1 มี EAN ตรงรุ่นจะจับคู่อัตโนมัติ / บรรทัดที่ 2 ไม่มี EAN จะส่งเข้าคิวให้ Admin อนุมัติ)
            </label>
            <textarea
              id="csv-textarea"
              rows={5}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={running}
            className="ui-interactive rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {running ? "กำลังประมวลผล Pipeline..." : "รันการนำเข้าข้อมูล CSV ทันที"}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {importResult && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-1">
            <div className="font-bold">
              ผลการรันงานนำเข้า (Job ID: {importResult.jobId}) — สถานะ:{" "}
              {importResult.status}
            </div>
            <div>
              ประมวลผลสำเร็จ: <strong>{importResult.recordsProcessed}</strong> แถว |
              จับคู่อัตโนมัติ (Auto-Matched):{" "}
              <strong>{importResult.autoMatchedCount}</strong> แถว |
              ส่งเข้าคิวตรวจสอบ (Needs Review):{" "}
              <strong>{importResult.queuedForReviewCount}</strong> แถว |
              บันทึกประวัติราคาใหม่:{" "}
              <strong>{importResult.snapshotsRecorded}</strong> จุด |
              ล้มเหลว: <strong>{importResult.recordsFailed}</strong> แถว
            </div>
          </div>
        )}
      </section>

      {/* Authorized Data Sources Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          แหล่งข้อมูลที่อนุญาตในระบบ (Authorized Data Sources — {sources.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          ไม่เก็บ API Key หรือรหัสลับแบบ Plaintext ในฐานข้อมูล (อ้างอิงผ่านชื่อตัวแปรสภาพแวดล้อมเท่านั้น)
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">ชื่อแหล่งข้อมูล</th>
                <th className="py-2 pr-4">ประเภท Adapter</th>
                <th className="py-2 pr-4">การตั้งค่า (Non-Secret Config)</th>
                <th className="py-2 text-right">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {s.name}
                  </td>
                  <td className="py-3 pr-4 font-mono text-blue-700">
                    {s.sourceType}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-slate-600">
                    {JSON.stringify(s.configuration)}
                  </td>
                  <td className="py-3 text-right">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
