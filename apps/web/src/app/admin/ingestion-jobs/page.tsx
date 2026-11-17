"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { browserApiClient } from "@/lib/client-api";

export default function AdminIngestionJobsPage() {
  const jobsQuery = useQuery({
    queryKey: ["admin-ingestion-jobs"],
    queryFn: async () => (await browserApiClient.getIngestionJobs()).data,
  });

  const jobs = jobsQuery.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          ติดตามสถานะงานนำเข้าข้อมูล (Ingestion Job Monitor)
        </h2>
        <p className="text-xs text-slate-500">
          บันทึกประวัติการรัน Pipeline ทั้งหมด จำนวนแถวที่ประมวลผลสำเร็จ แถวที่ล้มเหลว และสาเหตุของข้อผิดพลาด
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-3 pr-4">Job ID</th>
              <th className="py-3 pr-4">แหล่งข้อมูล</th>
              <th className="py-3 pr-4">ประเภทงาน</th>
              <th className="py-3 pr-4">สถานะ</th>
              <th className="py-3 pr-4 text-right">สำเร็จ</th>
              <th className="py-3 pr-4 text-right">ล้มเหลว</th>
              <th className="py-3 pr-4">ข้อความข้อผิดพลาด (ถ้ามี)</th>
              <th className="py-3 text-right">เวลาที่บันทึก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">
                  {job.id.slice(0, 8)}...
                </td>
                <td className="py-3 pr-4 font-semibold text-slate-900">
                  {job.sourceName}
                </td>
                <td className="py-3 pr-4 font-mono text-slate-600">
                  {job.jobType}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${
                      job.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : job.status === "partial"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums font-bold text-emerald-700">
                  {job.recordsProcessed}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums font-bold text-red-700">
                  {job.recordsFailed}
                </td>
                <td className="py-3 pr-4 max-w-xs truncate font-mono text-[11px] text-red-700">
                  {job.errorMessage ?? "-"}
                </td>
                <td className="py-3 text-right tabular-nums text-slate-500">
                  {new Date(job.createdAt).toLocaleString("th-TH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
