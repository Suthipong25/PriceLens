"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithToken, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => null)) as
        | { token?: string; message?: string }
        | null;
      if (!res.ok) {
        setError(json?.message ?? "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      if (json?.token) {
        await loginWithToken(json.token);
      } else {
        await refreshUser();
      }
      router.push("/dashboard");
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(token: string, redirectPath: string) {
    await loginWithToken(token);
    router.push(redirectPath);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900">
          เข้าสู่ระบบ PriceLens
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          เข้าสู่ระบบเพื่อจัดการรายการโปรด (Watchlist) และการแจ้งเตือนเมื่อราคาลง
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-slate-700"
            >
              อีเมล
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.co.th"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-700"
            >
              รหัสผ่าน
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ui-interactive w-full rounded-xl bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {submitting ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        {/* Instant Local Dev Demo Login */}
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-2">
          <span className="block text-xs font-semibold text-slate-500">
            เข้าสู่ระบบด่วนสำหรับทดสอบบนเครื่อง (Demo Accounts):
          </span>
          <button
            type="button"
            onClick={() =>
              void handleDemoLogin("demo_member_session_token_th", "/dashboard")
            }
            className="ui-interactive w-full rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            เข้าสู่ระบบในฐานะ สมาชิกตัวอย่าง (member@pricelens.co.th)
          </button>
          <button
            type="button"
            onClick={() =>
              void handleDemoLogin("demo_admin_session_token_th", "/admin")
            }
            className="ui-interactive w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            เข้าสู่ระบบในฐานะ ผู้ดูแลระบบ (admin@pricelens.co.th)
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ยังไม่มีบัญชีผู้ใช้?{" "}
          <Link
            href="/register"
            className="font-semibold text-blue-700 hover:underline"
          >
            สมัครสมาชิกใหม่
          </Link>
        </p>
      </div>
    </div>
  );
}
