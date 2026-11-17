"use client";

import React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPriceTHB } from "@pricelens/shared";
import { Bookmark, Trash2 } from "lucide-react";
import { browserApiClient } from "@/lib/client-api";
import { useAuth } from "@/components/providers";

export default function WatchlistPage() {
  const { user, loginWithToken } = useAuth();
  const queryClient = useQueryClient();

  const watchlistQuery = useQuery({
    queryKey: ["user-watchlist", user?.id],
    queryFn: async () => {
      const res = await browserApiClient.getWatchlist();
      return res.data;
    },
    enabled: Boolean(user),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await browserApiClient.removeFromWatchlist(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-watchlist"] });
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-lg font-bold text-slate-900">
            กรุณาเข้าสู่ระบบเพื่อดูรายการโปรดของคุณ
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

  const items = watchlistQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Bookmark className="h-6 w-6 text-blue-700" aria-hidden="true" />
            <span>รายการสินค้าที่บันทึกไว้ (Watchlist)</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            ติดตามราคาสินค้าที่คุณสนใจเปรียบเทียบจากหลายร้านค้า
          </p>
        </div>
        <Link
          href="/search"
          className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
        >
          + ค้นหาสินค้าเพิ่ม
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-slate-800">
            ยังไม่มีสินค้าในรายการโปรดของคุณ
          </p>
          <p className="mt-1 text-xs text-slate-500">
            คลิกปุ่ม &ldquo;บันทึกในรายการโปรด&rdquo; ในหน้ารายละเอียดสินค้าเพื่อเพิ่มลงในรายการนี้
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div>
                <span className="text-xs font-semibold text-blue-700">
                  {item.brand.name}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="hover:text-blue-700"
                  >
                    {item.product.name}
                  </Link>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  มีข้อเสนอจาก {item.offerCount} ร้านค้า &bull; บันทึกเมื่อ{" "}
                  {new Date(item.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[11px] text-slate-500">
                    ราคาต่ำสุดปัจจุบัน
                  </span>
                  <span className="tabular-nums text-lg font-extrabold text-blue-700">
                    {formatPriceTHB(item.lowestProductPrice)}
                  </span>
                </div>

                <Link
                  href={`/products/${item.product.slug}`}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ดูข้อเสนอ
                </Link>

                <button
                  type="button"
                  onClick={() => removeMutation.mutate(item.id)}
                  aria-label={`ลบ ${item.product.name} ออกจากรายการโปรด`}
                  className="rounded-xl border border-red-200 p-2 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
