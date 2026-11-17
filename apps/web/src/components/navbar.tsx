"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  LayoutDashboard,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useAuth } from "./providers";

const DEMO_MEMBER_TOKEN = "demo_member_session_token_th";
const DEMO_ADMIN_TOKEN = "demo_admin_session_token_th";

export function Navbar() {
  const pathname = usePathname();
  const { user, loginWithToken, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      {/* Demo Environment Transparency Notice */}
      <div className="bg-slate-900 px-4 py-1.5 text-xs text-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-300">
              [DEMO DATA]
            </span>
            <span>
              PriceLens Thailand — ข้อมูลตัวอย่างสำหรับการพัฒนาและทดสอบ ไม่มีการปลอมแปลงค่าจัดส่งหรือประวัติราคา
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">สลับบทบาททดสอบด่วน:</span>
            <button
              type="button"
              onClick={() => void loginWithToken(DEMO_MEMBER_TOKEN)}
              className="ui-interactive rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-blue-300 hover:bg-slate-700"
            >
              ทดลองเป็นสมาชิก (Member)
            </button>
            <button
              type="button"
              onClick={() => void loginWithToken(DEMO_ADMIN_TOKEN)}
              className="ui-interactive rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-emerald-300 hover:bg-slate-700"
            >
              ทดลองเป็นแอดมิน (Admin)
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">
              PL
            </span>
            <div>
              <span>PriceLens</span>
              <span className="ml-1.5 hidden text-xs font-normal text-slate-500 sm:inline">
                ช้อปฉลาด จ่ายน้อยกว่า
              </span>
            </div>
          </Link>

          <nav
            aria-label="เมนูหลัก"
            className="hidden items-center gap-1 md:flex"
          >
            <Link
              href="/search"
              className={`ui-interactive rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith("/search")
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              ค้นหาและเปรียบเทียบ
            </Link>
            <Link
              href="/categories/smartphones"
              className={`ui-interactive rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith("/categories")
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              หมวดหมู่สินค้า
            </Link>
            <Link
              href="/brands/apple"
              className={`ui-interactive rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith("/brands")
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              แบรนด์ชั้นนำ
            </Link>
          </nav>
        </div>

        {/* Global Search Form */}
        <form
          action="/search"
          method="GET"
          className="flex flex-1 items-center max-w-md"
          role="search"
        >
          <div className="relative w-full">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              name="q"
              aria-label="ค้นหาสินค้า แบรนด์ รหัสโมเดล หรือบาร์โค้ด EAN"
              placeholder="ค้นหาชื่อรุ่น, แบรนด์, EAN, MPN..."
              className="ui-interactive w-full rounded-xl border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white"
            />
          </div>
        </form>

        {/* User / Admin Actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/watchlist"
            className="ui-interactive inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Bookmark className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
            <span>รายการโปรด</span>
          </Link>
          <Link
            href="/dashboard/alerts"
            className="ui-interactive inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Bell className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            <span>แจ้งเตือนราคา</span>
          </Link>
          <Link
            href="/admin"
            className={`ui-interactive inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium ${
              pathname.startsWith("/admin")
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Admin</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/dashboard"
                className="ui-interactive inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="max-w-[120px] truncate">{user.name}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ"
                className="ui-interactive rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="ui-interactive inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>เข้าสู่ระบบ</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white py-10 text-sm text-slate-600">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-700 text-xs text-white">
              PL
            </span>
            <span>PriceLens Thailand</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            แพลตฟอร์มเปรียบเทียบราคาและวิเคราะห์ประวัติราคาสินค้าสำหรับตลาดไทย
            แยกแยะรุ่นสินค้าด้วยรหัสมาตรฐาน GTIN/EAN/MPN และคำนวณราคารวมค่าจัดส่งอย่างโปร่งใส
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
            การสำรวจสินค้า
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            <li>
              <Link href="/search" className="hover:text-blue-700">
                ค้นหาสินค้าทั้งหมด
              </Link>
            </li>
            <li>
              <Link href="/categories/smartphones" className="hover:text-blue-700">
                สมาร์ทโฟนและแท็บเล็ต
              </Link>
            </li>
            <li>
              <Link href="/categories/laptops" className="hover:text-blue-700">
                โน้ตบุ๊กและคอมพิวเตอร์พกพา
              </Link>
            </li>
            <li>
              <Link href="/categories/monitors" className="hover:text-blue-700">
                จอมอนิเตอร์
              </Link>
            </li>
            <li>
              <Link href="/categories/audio" className="hover:text-blue-700">
                หูฟังและเครื่องเสียง
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
            สำหรับสมาชิก
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            <li>
              <Link href="/dashboard" className="hover:text-blue-700">
                แดชบอร์ดบัญชีผู้ใช้
              </Link>
            </li>
            <li>
              <Link href="/dashboard/watchlist" className="hover:text-blue-700">
                รายการสินค้าที่บันทึกไว้ (Watchlist)
              </Link>
            </li>
            <li>
              <Link href="/dashboard/alerts" className="hover:text-blue-700">
                การแจ้งเตือนราคาเป้าหมาย (Price Alerts)
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-blue-700">
                เข้าสู่ระบบ / สมัครสมาชิก
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
            ผู้ดูแลระบบ & มาตรฐานข้อมูล
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            <li>
              <Link href="/admin" className="hover:text-blue-700">
                Admin Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/match-candidates" className="hover:text-blue-700">
                คิวตรวจสอบการจับคู่สินค้า (Matching Queue)
              </Link>
            </li>
            <li>
              <Link href="/admin/data-sources" className="hover:text-blue-700">
                จัดการแหล่งข้อมูล & นำเข้า CSV
              </Link>
            </li>
            <li>
              <a
                href="/api/v1/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-700"
              >
                OpenAPI 3.1 Specification (/api/v1)
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
