import React from "react";
import Link from "next/link";
import type { ProductSortOption } from "@pricelens/shared";
import { getServerApiClient } from "@/lib/server-api";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const categorySlug = firstParam(sp.categorySlug);
  const brandSlug = firstParam(sp.brandSlug);
  const merchantSlug = firstParam(sp.merchantSlug);
  const minPriceRaw = firstParam(sp.minPrice);
  const maxPriceRaw = firstParam(sp.maxPrice);
  const sort = (firstParam(sp.sort) as ProductSortOption | undefined) ?? "popularity";

  const minPrice =
    minPriceRaw && !Number.isNaN(Number(minPriceRaw))
      ? Number(minPriceRaw)
      : undefined;
  const maxPrice =
    maxPriceRaw && !Number.isNaN(Number(maxPriceRaw))
      ? Number(maxPriceRaw)
      : undefined;

  const api = await getServerApiClient();
  const [productsRes, categoriesRes, brandsRes, merchantsRes] =
    await Promise.all([
      api.getProducts({
        q,
        categorySlug,
        brandSlug,
        merchantSlug,
        minPrice,
        maxPrice,
        sort,
      }),
      api.getCategories(),
      api.getBrands(),
      api.getMerchants(),
    ]);

  const products = productsRes.data;
  const categories = categoriesRes.data;
  const brands = brandsRes.data;
  const merchants = merchantsRes.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          ค้นหาและเปรียบเทียบราคาสินค้า
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          ค้นหาด้วยชื่อรุ่น, แบรนด์, รหัสโมเดล (MPN) หรือบาร์โค้ดมาตรฐาน (EAN / GTIN)
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Facet Filter Sidebar */}
        <aside
          aria-label="ตัวกรองการค้นหา"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs h-fit"
        >
          <form action="/search" method="GET" className="space-y-4">
            <div>
              <label
                htmlFor="filter-q"
                className="block text-xs font-semibold text-slate-700"
              >
                คำค้นหา / EAN / MPN
              </label>
              <input
                id="filter-q"
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="เช่น iPhone 16 Pro, MYN13TH/A"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="filter-category"
                className="block text-xs font-semibold text-slate-700"
              >
                หมวดหมู่สินค้า
              </label>
              <select
                id="filter-category"
                name="categorySlug"
                defaultValue={categorySlug ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-brand"
                className="block text-xs font-semibold text-slate-700"
              >
                แบรนด์
              </label>
              <select
                id="filter-brand"
                name="brandSlug"
                defaultValue={brandSlug ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                <option value="">ทุกแบรนด์</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-merchant"
                className="block text-xs font-semibold text-slate-700"
              >
                ร้านค้า
              </label>
              <select
                id="filter-merchant"
                name="merchantSlug"
                defaultValue={merchantSlug ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                <option value="">ทุกร้านค้า</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="filter-min-price"
                  className="block text-xs font-semibold text-slate-700"
                >
                  ราคาต่ำสุด (฿)
                </label>
                <input
                  id="filter-min-price"
                  type="number"
                  name="minPrice"
                  min="0"
                  defaultValue={minPriceRaw ?? ""}
                  placeholder="0"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="filter-max-price"
                  className="block text-xs font-semibold text-slate-700"
                >
                  ราคาสูงสุด (฿)
                </label>
                <input
                  id="filter-max-price"
                  type="number"
                  name="maxPrice"
                  min="0"
                  defaultValue={maxPriceRaw ?? ""}
                  placeholder="100000"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="filter-sort"
                className="block text-xs font-semibold text-slate-700"
              >
                เรียงลำดับตาม
              </label>
              <select
                id="filter-sort"
                name="sort"
                defaultValue={sort}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900"
              >
                <option value="popularity">ความนิยมสูงสุด</option>
                <option value="price_asc">ราคาสินค้า: ต่ำ ไป สูง</option>
                <option value="total_price_asc">
                  ราคารวมค่าส่งที่ยืนยันแล้ว: ต่ำ ไป สูง
                </option>
                <option value="price_desc">ราคาสินค้า: สูง ไป ต่ำ</option>
                <option value="updated_desc">อัปเดตราคาล่าสุด</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                className="ui-interactive w-full rounded-xl bg-blue-700 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                ใช้ตัวกรองค้นหา
              </button>
              <Link
                href="/search"
                className="ui-interactive w-full rounded-xl border border-slate-200 py-2 text-center text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ล้างตัวกรองทั้งหมด
              </Link>
            </div>
          </form>
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span>
              พบสินค้าตรงเงื่อนไข{" "}
              <strong className="font-bold text-slate-900">
                {productsRes.pagination.totalItems}
              </strong>{" "}
              รายการ
            </span>
            <span>สกุลเงิน: THB (บาท)</span>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <h2 className="text-base font-bold text-slate-900">
                ไม่พบสินค้าที่ตรงกับตัวกรองของคุณ
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองช่วงราคาเพื่อดูสินค้าทั้งหมดในระบบ
              </p>
              <Link
                href="/search"
                className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
              >
                ดูสินค้าทั้งหมด
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
