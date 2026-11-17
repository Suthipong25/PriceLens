"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, Bookmark, ShieldCheck, Trash2, User } from "lucide-react";
import { useAuth } from "@/components/providers";
import { browserApiClient } from "@/lib/client-api";

export default function UserDashboardPage() {
  const { user, loading, loginWithToken, logout } = useAuth();
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-slate-500">
        กำลังโหลดข้อมูลบัญชีผู้ใช้...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <h1 className="text-xl font-bold text-slate-900">
            กรุณาเข้าสู่ระบบเพื่อใช้งานแดชบอร์ด
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            คุณสามารถเข้าสู่ระบบด้วยบัญชีของคุณ หรือคลิกปุ่มด้านล่างเพื่อทดลองใช้งานด้วยบัญชีสมาชิกตัวอย่างทันที
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void loginWithToken("demo_member_session_token_th")}
              className="ui-interactive rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              ทดลองเข้าใช้ด้วยบัญชีสมาชิก (Demo Member)
            </button>
            <Link
              href="/login"
              className="ui-interactive rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ไปที่หน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (confirmDeleteText !== "DELETE") {
      setDeleteError("กรุณาพิมพ์คำว่า DELETE ตัวพิมพ์ใหญ่เพื่อยืนยันการลบบัญชี");
      return;
    }
    try {
      await browserApiClient.deleteMe();
      logout();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "ไม่สามารถลบบัญชีผู้ใช้ได้",
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <User className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
              <p className="text-xs text-slate-500">
                {user.email} &bull; บทบาท:{" "}
                <strong className="uppercase text-slate-800">{user.role}</strong>
              </p>
            </div>
          </div>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className="ui-interactive inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>เปิดคอนโซลผู้ดูแลระบบ (Admin)</span>
            </Link>
          )}
        </div>

        {/* KPI Cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/dashboard/watchlist"
            className="ui-interactive rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                รายการโปรด (Watchlist)
              </span>
              <Bookmark className="h-4 w-4 text-blue-700" aria-hidden="true" />
            </div>
            <div className="mt-2 tabular-nums text-2xl font-extrabold text-slate-900">
              {user.stats.watchlistCount} รายการ
            </div>
            <span className="mt-1 block text-xs text-blue-700 font-medium">
              จัดการรายการโปรด &rarr;
            </span>
          </Link>

          <Link
            href="/dashboard/alerts"
            className="ui-interactive rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:border-blue-400"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                แจ้งเตือนราคาที่เปิดใช้งาน
              </span>
              <Bell className="h-4 w-4 text-amber-600" aria-hidden="true" />
            </div>
            <div className="mt-2 tabular-nums text-2xl font-extrabold text-slate-900">
              {user.stats.activeAlertsCount} / {user.stats.totalAlertsCount}
            </div>
            <span className="mt-1 block text-xs text-blue-700 font-medium">
              จัดการการแจ้งเตือนราคา &rarr;
            </span>
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <span className="text-xs font-semibold text-slate-600">
              สถานะการยืนยันอีเมล
            </span>
            <div className="mt-2 text-lg font-bold text-emerald-700">
              {user.emailVerified ? "ยืนยันแล้ว (Verified)" : "รอยืนยัน"}
            </div>
            <span className="mt-1 block text-xs text-slate-500">
              พร้อมรับอีเมลแจ้งเตือนเมื่อราคาสินค้าลดลง
            </span>
          </div>
        </div>
      </div>

      {/* PDPA Account Deletion Workflow (Section 10 Security Requirement) */}
      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-red-800">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>การลบบัญชีผู้ใช้และข้อมูลส่วนบุคคล (PDPA Compliance)</span>
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          เมื่อลบบัญชี ระบบจะลบข้อมูลรายการโปรด การแจ้งเตือนราคา และประวัติการแจ้งเตือนทั้งหมดของคุณทันทีแบบถาวร
        </p>

        <form
          onSubmit={(e) => void handleDeleteAccount(e)}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <label htmlFor="confirm-delete-input" className="sr-only">
            พิมพ์ DELETE เพื่อยืนยันการลบบัญชี
          </label>
          <input
            id="confirm-delete-input"
            type="text"
            value={confirmDeleteText}
            onChange={(e) => setConfirmDeleteText(e.target.value)}
            placeholder="พิมพ์ DELETE เพื่อยืนยัน"
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
          />
          <button
            type="submit"
            className="ui-interactive rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
          >
            ลบบัญชีผู้ใช้ถาวร
          </button>
        </form>
        {deleteError && (
          <p className="mt-2 text-xs font-medium text-red-700">{deleteError}</p>
        )}
      </section>
    </div>
  );
}
