"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPriceTHB } from "@pricelens/shared";
import { browserApiClient, getStoredAuthToken } from "@/lib/client-api";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({
    queryKey: ["admin-products-list"],
    queryFn: async () => {
      const res = await browserApiClient.getProducts({ limit: 50 });
      return res.data;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await browserApiClient.getCategories()).data,
  });

  const brandsQuery = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => (await browserApiClient.getBrands()).data,
  });

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [storageCapacity, setStorageCapacity] = useState("");
  const [ram, setRam] = useState("");
  const [color, setColor] = useState("");
  const [ean, setEan] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const token = getStoredAuthToken();
    const identifiers = [];
    if (ean.trim()) {
      identifiers.push({ type: "EAN", value: ean.trim() });
    }
    if (model.trim()) {
      identifiers.push({ type: "MPN", value: model.trim() });
    }

    const res = await fetch("/api/v1/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name,
        model: model || null,
        categoryId: categoryId || categoriesQuery.data?.[0]?.id,
        brandId: brandId || brandsQuery.data?.[0]?.id,
        attributes: {
          ...(storageCapacity ? { storage_capacity: storageCapacity } : {}),
          ...(ram ? { ram } : {}),
          ...(color ? { color } : {}),
          condition: "new",
          is_demo: true,
        },
        identifiers,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setStatusMsg(err?.error?.message ?? "สร้างสินค้าไม่สำเร็จ");
      return;
    }

    setName("");
    setModel("");
    setEan("");
    setStatusMsg("เพิ่มสินค้าหลัก (Canonical Product) สำเร็จ!");
    await queryClient.invalidateQueries({ queryKey: ["admin-products-list"] });
  }

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const brands = brandsQuery.data ?? [];

  return (
    <div className="space-y-8">
      {/* Create Canonical Product Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          เพิ่มสินค้าหลักใหม่ (Create Canonical Product)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          กำหนดรหัสมาตรฐาน (EAN / MPN) และคุณสมบัติรุ่นย่อย (ความจุ / RAM / สี) เพื่อให้ระบบจับคู่สินค้าทำงานได้แม่นยำ
        </p>

        <form
          onSubmit={(e) => void handleCreateProduct(e)}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">
              ชื่อสินค้า (ระบุรุ่นและความจุให้ชัดเจน)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น Apple iPad Air M2 11-inch 256GB Wi-Fi Space Gray"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              หมวดหมู่
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              แบรนด์
            </label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              รหัสโมเดล / MPN
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="เช่น MUWG3TH/A"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              รหัสบาร์โค้ด EAN / GTIN
            </label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              placeholder="เช่น 0195949654321"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              ความจุ (Storage)
            </label>
            <input
              type="text"
              value={storageCapacity}
              onChange={(e) => setStorageCapacity(e.target.value)}
              placeholder="เช่น 256GB"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              RAM / สี
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={ram}
                onChange={(e) => setRam(e.target.value)}
                placeholder="RAM 8GB"
                className="w-1/2 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="สี Space Gray"
                className="w-1/2 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-2">
            {statusMsg ? (
              <span className="text-xs font-semibold text-emerald-700">
                {statusMsg}
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="ui-interactive rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              + บันทึกสินค้าหลัก
            </button>
          </div>
        </form>
      </section>

      {/* Canonical Products Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          รายการสินค้าหลักทั้งหมด ({products.length})
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">ชื่อสินค้า</th>
                <th className="py-2 pr-4">แบรนด์ / หมวดหมู่</th>
                <th className="py-2 pr-4">รหัส Model & Identifiers</th>
                <th className="py-2 pr-4">คุณสมบัติรุ่นย่อย (Attributes)</th>
                <th className="py-2 text-right">ราคาต่ำสุด / จำนวนร้าน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {p.name}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {p.brand.name} &bull; {p.category.name}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-slate-700">
                    {p.identifiers.map((i) => `${i.type}:${i.value}`).join(", ") ||
                      p.model ||
                      "-"}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {[
                      p.attributes.storage_capacity,
                      p.attributes.ram,
                      p.attributes.color,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </td>
                  <td className="py-3 text-right tabular-nums font-semibold text-blue-700">
                    {formatPriceTHB(p.priceSummary.lowestProductPrice)} (
                    {p.priceSummary.offerCount} ร้าน)
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
