"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Box,
  Database,
  GitCompare,
  LayoutDashboard,
  ShieldAlert,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/providers";

const ADMIN_NAV = [
  { href: "/admin", label: "ภาพรวม & คุณภาพข้อมูล", icon: LayoutDashboard },
  { href: "/admin/products", label: "จัดการสินค้า & หมวดหมู่", icon: Box },
  { href: "/admin/merchants", label: "จัดการร้านค้า", icon: Store },
  { href: "/admin/data-sources", label: "แหล่งข้อมูล & นำเข้า CSV", icon: Database },
  {
    href: "/admin/match-candidates",
    label: "คิวตรวจสอบจับคู่สินค้า",
    icon: GitCompare,
  },
  {
    href: "/admin/ingestion-jobs",
    label: "ติดตามงานนำเข้า (Jobs)",
    icon: Activity,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, loginWithToken } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">
        กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            ต้องใช้สิทธิ์ผู้ดูแลระบบ (Admin Only — 403 Forbidden)
          </h1>
          <p className="mt-2 text-xs text-slate-600">
            ส่วนจัดการแคตตาล็อก การนำเข้าข้อมูล และคิวอนุมัติการจับคู่สินค้าสงวนสิทธิ์เฉพาะผู้ดูแลระบบเท่านั้น
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void loginWithToken("demo_admin_session_token_th")}
              className="ui-interactive rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              สลับเป็นบัญชีผู้ดูแลระบบตัวอย่าง (Demo Admin)
            </button>
            <Link
              href="/"
              className="ui-interactive rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              กลับหน้าแรก
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 px-6 py-4 text-white">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
            PriceLens Admin Console
          </span>
          <h1 className="text-lg font-bold">
            ระบบจัดการแคตตาล็อก แหล่งข้อมูล และตรวจสอบการจับคู่สินค้า
          </h1>
        </div>
        <span className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs text-emerald-300 font-medium">
          Admin: {user.email}
        </span>
      </div>

      {/* Admin Sub-Navigation */}
      <nav
        aria-label="เมนูผู้ดูแลระบบ"
        className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4"
      >
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`ui-interactive inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                active
                  ? "bg-blue-700 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
