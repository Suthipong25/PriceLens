"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";

export default function RegisterPage() {
  const router = useRouter();
  const { loginWithToken, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = (await res.json().catch(() => null)) as
        | { token?: string; message?: string }
        | null;
      if (!res.ok) {
        setError(json?.message ?? "ไม่สามารถสร้างบัญชีได้ กรุณาตรวจสอบข้อมูล");
        return;
      }
      if (json?.token) {
        await loginWithToken(json.token);
      } else {
        await refreshUser();
      }
      router.push("/dashboard");
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900">
          สมัครสมาชิก PriceLens
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          สร้างบัญชีฟรีเพื่อบันทึกสินค้าและรับการแจ้งเตือนเมื่อราคาสินค้าลดถึงเป้าหมาย
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="reg-name"
              className="block text-xs font-semibold text-slate-700"
            >
              ชื่อ-นามสกุล หรือชื่อที่แสดง
            </label>
            <input
              id="reg-name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="สมหญิง ใจดี"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-xs font-semibold text-slate-700"
            >
              อีเมล
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="somying@example.co.th"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label
              htmlFor="reg-password"
              className="block text-xs font-semibold text-slate-700"
            >
              รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
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
            {submitting ? "กำลังสร้างบัญชี..." : "สร้างบัญชีผู้ใช้"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          มีบัญชีอยู่แล้ว?{" "}
          <Link
            href="/login"
            className="font-semibold text-blue-700 hover:underline"
          >
            เข้าสู่ระบบที่นี่
          </Link>
        </p>
      </div>
    </div>
  );
}
