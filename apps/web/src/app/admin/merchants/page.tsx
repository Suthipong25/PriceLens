"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { browserApiClient, getStoredAuthToken } from "@/lib/client-api";

export default function AdminMerchantsPage() {
  const queryClient = useQueryClient();
  const merchantsQuery = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async () => (await browserApiClient.getMerchants()).data,
  });

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<
    "verified" | "unverified" | "unknown"
  >("verified");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleCreateMerchant(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const token = getStoredAuthToken();

    const res = await fetch("/api/v1/admin/merchants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name,
        website,
        verificationStatus,
        status: "active",
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setStatusMsg(err?.error?.message ?? "เพิ่มร้านค้าไม่สำเร็จ");
      return;
    }

    setName("");
    setWebsite("");
    setStatusMsg("เพิ่มร้านค้าใหม่เข้าสู่ระบบเรียบร้อยแล้ว!");
    await queryClient.invalidateQueries({ queryKey: ["admin-merchants"] });
  }

  const merchants = merchantsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          เพิ่มร้านค้าใหม่ (Create Merchant)
        </h2>

        <form
          onSubmit={(e) => void handleCreateMerchant(e)}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              ชื่อร้านค้า
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น IT City Official"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              เว็บไซต์หลัก (https://)
            </label>
            <input
              type="url"
              required
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.itcity.in.th"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              สถานะการยืนยันร้านค้า
            </label>
            <select
              value={verificationStatus}
              onChange={(e) =>
                setVerificationStatus(
                  e.target.value as "verified" | "unverified" | "unknown",
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            >
              <option value="verified">ยืนยันแล้ว (Verified)</option>
              <option value="unverified">ยังไม่ยืนยัน (Unverified)</option>
              <option value="unknown">ไม่ระบุ (Unknown)</option>
            </select>
          </div>

          <div className="sm:col-span-3 flex items-center justify-between pt-2">
            {statusMsg ? (
              <span className="text-xs font-semibold text-emerald-700">
                {statusMsg}
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="ui-interactive rounded-xl bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              + บันทึกร้านค้า
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          ร้านค้าทั้งหมดในระบบ ({merchants.length})
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">ชื่อร้านค้า</th>
                <th className="py-2 pr-4">Slug</th>
                <th className="py-2 pr-4">เว็บไซต์</th>
                <th className="py-2 pr-4">สถานะการยืนยัน</th>
                <th className="py-2 text-right">จำนวนข้อเสนอที่เปิดขาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {merchants.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {m.name}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-500">
                    {m.slug}
                  </td>
                  <td className="py-3 pr-4 text-blue-700">{m.website}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 font-medium">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      <span>{m.verificationStatus}</span>
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums font-bold text-slate-900">
                    {m.activeOfferCount}
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
