import React from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Search,
  ShieldCheck,
  TrendingDown,
  Truck,
} from "lucide-react";
import { getServerApiClient } from "@/lib/server-api";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const api = await getServerApiClient();
  const [productsRes, categoriesRes, brandsRes, merchantsRes] =
    await Promise.all([
      api.getProducts({ sort: "popularity", limit: 8 }),
      api.getCategories(),
      api.getBrands(),
      api.getMerchants(),
    ]);

  const products = productsRes.data;
  const subCategories = categoriesRes.data.filter((c) => c.parentId !== null);
  const brands = brandsRes.data;
  const merchants = merchantsRes.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-14">
      {/* Hero Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ระบบเปรียบเทียบราคาและตรวจสอบรุ่นสินค้าแม่นยำสำหรับตลาดไทย</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            เช็กราคาจริง เปรียบเทียบราคารวมส่ง และรู้จังหวะซื้อที่คุ้มที่สุด
          </h1>
          <p className="mt-3 text-base text-slate-600">
            PriceLens แยกแยะสินค้ารุ่นย่อยด้วยรหัสมาตรฐาน GTIN / EAN / MPN
            ไม่นำความจุหรือสีต่างกันมารวมมั่ว และแยกค่าจัดส่งที่ยืนยันแล้วออกจากร้านที่ไม่ระบุค่าส่งอย่างตรงไปตรงมา
          </p>

          <form
            action="/search"
            method="GET"
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                name="q"
                aria-label="ค้นหาสินค้าด้วยชื่อรุ่น แบรนด์ รหัสโมเดล หรือบาร์โค้ด EAN"
                placeholder="ค้นหา เช่น iPhone 16 Pro 256GB, MYN13TH/A, 0195949821943, WH-1000XM5..."
                className="ui-interactive w-full rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 focus:border-blue-600 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="ui-interactive rounded-2xl bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              ค้นหาและเปรียบเทียบราคา
            </button>
          </form>

          {/* Value Proposition Highlights */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-700"
                aria-hidden="true"
              />
              <div className="text-xs">
                <strong className="block font-semibold text-slate-900">
                  ตรงรุ่น 100% (Deterministic Matching)
                </strong>
                <span className="text-slate-500">
                  ไม่ปะปนความจุ 256GB กับ 512GB หรือสีที่ต่างกัน
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Truck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <div className="text-xs">
                <strong className="block font-semibold text-slate-900">
                  โปร่งใสเรื่องค่าจัดส่ง
                </strong>
                <span className="text-slate-500">
                  แยกแยะ &ldquo;ส่งฟรี (฿0.00)&rdquo; ออกจาก &ldquo;ไม่ระบุค่าจัดส่ง&rdquo;
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <TrendingDown
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <div className="text-xs">
                <strong className="block font-semibold text-slate-900">
                  กราฟราคาจริง & แจ้งเตือนเมื่อราคาลง
                </strong>
                <span className="text-slate-500">
                  ดูสถิติต่ำสุด/สูงสุดย้อนหลัง 7–365 วัน พร้อมตั้งเป้าแจ้งเตือน
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories & Brands */}
      <section aria-labelledby="browse-categories-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="browse-categories-heading"
            className="text-xl font-bold text-slate-900"
          >
            หมวดหมู่สินค้า (Categories)
          </h2>
          <Link
            href="/search"
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            ดูสินค้าทั้งหมด &rarr;
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {subCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="ui-interactive rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-xs"
            >
              <div className="text-sm font-semibold text-slate-900">
                {cat.name}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {cat.productCount} รายการในระบบ
              </div>
            </Link>
          ))}
        </div>

        {/* Brand & Merchant Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">
            แบรนด์ยอดนิยม:
          </span>
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.slug}`}
              className="ui-interactive rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              {brand.name} ({brand.productCount})
            </Link>
          ))}
          <span className="ml-4 text-xs font-semibold text-slate-500 mr-1">
            ร้านค้าที่เชื่อมต่อ:
          </span>
          {merchants.map((m) => (
            <Link
              key={m.id}
              href={`/search?merchantSlug=${m.slug}`}
              className="ui-interactive rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              {m.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Grid */}
      <section aria-labelledby="featured-products-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="featured-products-heading"
              className="text-xl font-bold text-slate-900"
            >
              สินค้าเปรียบเทียบราคายอดนิยม
            </h2>
            <p className="text-xs text-slate-500">
              เปรียบเทียบราคาจากหลายร้านค้าพร้อมประวัติราคาย้อนหลัง
            </p>
          </div>
          <Link
            href="/search?sort=price_asc"
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            ค้นหาขั้นสูง &rarr;
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
