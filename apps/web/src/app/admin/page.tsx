"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Database,
  GitCompare,
  Store,
} from "lucide-react";
import { browserApiClient } from "@/lib/client-api";

export default function AdminDashboardPage() {
  const qualityQuery = useQuery({
    queryKey: ["admin-data-quality"],
    queryFn: async () => {
      const res = await browserApiClient.getDataQualityReport();
      return res.data;
    },
  });

  const jobsQuery = useQuery({
    queryKey: ["admin-ingestion-jobs"],
    queryFn: async () => {
      const res = await browserApiClient.getIngestionJobs();
      return res.data;
    },
  });

  const q = qualityQuery.data;
  const recentJobs = (jobsQuery.data ?? []).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* KPI & Data Quality Summary */}
      <section aria-labelledby="admin-kpi-heading">
        <h2 id="admin-kpi-heading" className="text-lg font-bold text-slate-900">
          รายงานคุณภาพข้อมูลและสถานะระบบ (Data Quality Report)
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500">
              สินค้าหลักในระบบ (Canonical Products)
            </span>
            <div className="mt-2 tabular-nums text-3xl font-extrabold text-slate-900">
              {q?.totalProducts ?? "-"}
            </div>
            <Link
              href="/admin/products"
              className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
            >
              จัดการสินค้า &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500">
              ข้อเสนอราคาจากร้านค้าทั้งหมด (Offers)
            </span>
            <div className="mt-2 tabular-nums text-3xl font-extrabold text-blue-700">
              {q?.totalOffers ?? "-"}
            </div>
            <span className="mt-2 block text-xs text-slate-500">
              ไม่ระบุค่าจัดส่ง: {q?.offersWithUnknownShippingCount ?? 0} รายการ
            </span>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
            <span className="text-xs font-semibold text-amber-900">
              รอตรวจสอบในคิวจับคู่สินค้า (Pending Match Review)
            </span>
            <div className="mt-2 tabular-nums text-3xl font-extrabold text-amber-800">
              {q?.pendingMatchCandidatesCount ?? "-"}
            </div>
            <Link
              href="/admin/match-candidates"
              className="mt-2 inline-block text-xs font-semibold text-amber-900 underline"
            >
              เปิดคิวอนุมัติ/ปฏิเสธ &rarr;
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500">
              สินค้าที่ยังไม่มีรหัสมาตรฐาน (Missing EAN/MPN)
            </span>
            <div className="mt-2 tabular-nums text-2xl font-bold text-slate-900">
              {q?.productsMissingIdentifiers ?? 0} รายการ
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="text-xs font-semibold text-slate-500">
              ข้อเสนอที่ไม่อัปเดตเกิน 48 ชั่วโมง (Stale Offers)
            </span>
            <div className="mt-2 tabular-nums text-2xl font-bold text-slate-900">
              {q?.staleOffersCount ?? 0} รายการ
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">
              การนำเข้าข้อมูลด่วน (CSV / Partner Feed)
            </span>
            <Link
              href="/admin/data-sources"
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              ไปที่หน้านำเข้าข้อมูล CSV &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Ingestion Jobs */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            งานนำเข้าข้อมูลล่าสุด (Recent Ingestion Jobs)
          </h2>
          <Link
            href="/admin/ingestion-jobs"
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            ดูทั้งหมด &rarr;
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">แหล่งข้อมูล</th>
                <th className="py-2 pr-4">ประเภทงาน</th>
                <th className="py-2 pr-4">สถานะ</th>
                <th className="py-2 pr-4 text-right">สำเร็จ</th>
                <th className="py-2 pr-4 text-right">ล้มเหลว</th>
                <th className="py-2 text-right">เวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {job.sourceName}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-600">
                    {job.jobType}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
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
                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-emerald-700">
                    {job.recordsProcessed}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-red-700">
                    {job.recordsFailed}
                  </td>
                  <td className="py-3 text-right tabular-nums text-slate-500">
                    {new Date(job.createdAt).toLocaleString("th-TH")}
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
