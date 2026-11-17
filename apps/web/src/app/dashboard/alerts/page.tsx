"use client";

import React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPriceTHB } from "@pricelens/shared";
import { Bell, MailCheck, Pause, Play, Trash2 } from "lucide-react";
import { browserApiClient } from "@/lib/client-api";
import { useAuth } from "@/components/providers";

export default function PriceAlertsPage() {
  const { user, loginWithToken } = useAuth();
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ["user-price-alerts", user?.id],
    queryFn: async () => {
      const res = await browserApiClient.getPriceAlerts();
      return res.data;
    },
    enabled: Boolean(user),
  });

  const toggleMutation = useMutation({
    mutationFn: async (params: { id: string; isActive: boolean }) => {
      await browserApiClient.updatePriceAlert(params.id, {
        isActive: params.isActive,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-price-alerts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await browserApiClient.deletePriceAlert(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-price-alerts"] });
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-lg font-bold text-slate-900">
            กรุณาเข้าสู่ระบบเพื่อจัดการการแจ้งเตือนราคา
          </h1>
          <button
            type="button"
            onClick={() => void loginWithToken("demo_member_session_token_th")}
            className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
          >
            เข้าสู่ระบบด้วยบัญชีสมาชิกตัวอย่าง (Demo Member)
          </button>
        </div>
      </div>
    );
  }

  const alerts = alertsQuery.data?.alerts ?? [];
  const notifications = alertsQuery.data?.recentNotifications ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Bell className="h-6 w-6 text-amber-600" aria-hidden="true" />
          <span>การแจ้งเตือนเมื่อราคาลงถึงเป้า (Price Alerts)</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          ระบบจะส่งอีเมลแจ้งเตือนเมื่อมีร้านค้าที่มีสต็อกพร้อมส่งตั้งราคาเท่ากับหรือต่ำกว่าราคาเป้าหมายของคุณ พร้อมระบบป้องกันการส่งอีเมลซ้ำ
        </p>
      </div>

      {/* Active / Paused Alerts List */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          รายการเป้าหมายราคาของคุณ ({alerts.length})
        </h2>

        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">
              ยังไม่มีการตั้งแจ้งเตือนราคา
            </p>
            <p className="mt-1 text-xs text-slate-500">
              เลือกสินค้าที่คุณต้องการแล้วกำหนดราคาเป้าหมายในหน้ารายละเอียดสินค้า
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
            >
              ค้นหาสินค้าเพื่อตั้งแจ้งเตือน
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        alert.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {alert.isActive ? "กำลังทำงาน (Active)" : "หยุดชั่วคราว (Paused)"}
                    </span>
                    {alert.lastNotifiedAt && (
                      <span className="text-[11px] text-slate-500">
                        แจ้งเตือนล่าสุด:{" "}
                        {new Date(alert.lastNotifiedAt).toLocaleString("th-TH")}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1.5 text-base font-bold text-slate-900">
                    <Link
                      href={`/products/${alert.product.slug}`}
                      className="hover:text-blue-700"
                    >
                      {alert.product.name}
                    </Link>
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <span className="block text-[11px] text-slate-500">
                      ราคาเป้าหมาย
                    </span>
                    <span className="tabular-nums text-lg font-extrabold text-blue-700">
                      {formatPriceTHB(alert.targetPrice)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      toggleMutation.mutate({
                        id: alert.id,
                        isActive: !alert.isActive,
                      })
                    }
                    className="ui-interactive inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {alert.isActive ? (
                      <>
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>พักการแจ้งเตือน</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>เปิดใช้งาน</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(alert.id)}
                    aria-label={`ลบการแจ้งเตือนสำหรับ ${alert.product.name}`}
                    className="rounded-xl border border-red-200 p-2 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notification Delivery History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <MailCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span>ประวัติการส่งแจ้งเตือน (Notification Delivery Log)</span>
        </h2>

        {notifications.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            ยังไม่มีประวัติการส่งแจ้งเตือนในขณะนี้
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 text-xs">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <span
                    className={`mr-2 rounded px-2 py-0.5 font-semibold ${
                      n.status === "sent"
                        ? "bg-emerald-100 text-emerald-800"
                        : n.status === "suppressed_duplicate"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {n.status}
                  </span>
                  <span className="text-slate-800">{n.message}</span>
                </div>
                <span className="tabular-nums text-slate-500">
                  {new Date(n.createdAt).toLocaleString("th-TH")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
