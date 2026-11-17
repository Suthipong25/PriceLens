"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  MerchantOfferItem,
  ProductDetail,
  ProductHistoryResponse,
} from "@pricelens/api-client";
import {
  formatPriceTHB,
  formatShippingTHB,
  HISTORY_PERIODS,
  type HistoryPeriod,
  type OfferSortOption,
} from "@pricelens/shared";
import {
  AlertTriangle,
  Bell,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { browserApiClient } from "@/lib/client-api";
import { useAuth } from "./providers";

interface ProductDetailInteractiveProps {
  product: ProductDetail;
  initialOffers: MerchantOfferItem[];
  initialHistory: ProductHistoryResponse;
}

export function ProductDetailInteractive({
  product,
  initialOffers,
  initialHistory,
}: ProductDetailInteractiveProps) {
  const { user } = useAuth();
  const [offerSort, setOfferSort] = useState<OfferSortOption>("price_asc");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [period, setPeriod] = useState<HistoryPeriod>("30d");

  const [targetPriceInput, setTargetPriceInput] = useState(
    product.priceSummary.lowestProductPrice
      ? String(Math.max(100, Number(product.priceSummary.lowestProductPrice) - 1000))
      : "10000",
  );
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const offersQuery = useQuery({
    queryKey: ["product-offers", product.id, offerSort, inStockOnly],
    queryFn: async () => {
      const res = await browserApiClient.getProductOffers(product.id, {
        sort: offerSort,
        inStockOnly,
      });
      return res.data;
    },
    initialData:
      offerSort === "price_asc" && !inStockOnly ? initialOffers : undefined,
  });

  const historyQuery = useQuery({
    queryKey: ["product-history", product.id, period],
    queryFn: async () => {
      const res = await browserApiClient.getProductHistory(product.id, period);
      return res.data;
    },
    initialData: period === "30d" ? initialHistory : undefined,
  });

  const offers = offersQuery.data ?? initialOffers;
  const history = historyQuery.data ?? initialHistory;

  async function handleSaveWatchlist() {
    setFeedbackMsg(null);
    if (!user) {
      setFeedbackMsg({
        type: "error",
        text: "กรุณาเข้าสู่ระบบ หรือคลิกปุ่ม 'ทดลองเป็นสมาชิก (Member)' ด้านบนเพื่อบันทึกสินค้า",
      });
      return;
    }
    try {
      await browserApiClient.addToWatchlist(product.id);
      setFeedbackMsg({
        type: "success",
        text: `บันทึก "${product.name}" ลงในรายการโปรดเรียบร้อยแล้ว`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "ไม่สามารถบันทึกได้",
      });
    }
  }

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackMsg(null);
    if (!user) {
      setFeedbackMsg({
        type: "error",
        text: "กรุณาเข้าสู่ระบบ หรือคลิกปุ่ม 'ทดลองเป็นสมาชิก (Member)' ด้านบนเพื่อตั้งแจ้งเตือนราคา",
      });
      return;
    }
    try {
      await browserApiClient.createPriceAlert({
        productId: product.id,
        targetPrice: targetPriceInput,
      });
      setFeedbackMsg({
        type: "success",
        text: `ตั้งแจ้งเตือนราคาเป้าหมายที่ ${formatPriceTHB(targetPriceInput)} สำเร็จ!`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: "error",
        text: err instanceof Error ? err.message : "ตั้งแจ้งเตือนไม่สำเร็จ",
      });
    }
  }

  async function handleOfferOutboundClick(offer: MerchantOfferItem) {
    try {
      const res = await browserApiClient.trackOfferClick(offer.id);
      window.open(res.data.targetUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.open(offer.productUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-10">
      {/* Watchlist & Price Alert Action Bar */}
      <section
        aria-label="การติดตามและตั้งแจ้งเตือนราคา"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveWatchlist()}
              className="ui-interactive inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Bookmark className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>บันทึกในรายการโปรด (Watchlist)</span>
            </button>
          </div>

          <form
            onSubmit={(e) => void handleCreateAlert(e)}
            className="flex flex-wrap items-center gap-2"
          >
            <label
              htmlFor="target-price-input"
              className="text-xs font-medium text-slate-700"
            >
              แจ้งเตือนเมื่อราคาต่ำกว่า (บาท):
            </label>
            <input
              id="target-price-input"
              type="number"
              min="1"
              step="0.01"
              value={targetPriceInput}
              onChange={(e) => setTargetPriceInput(e.target.value)}
              className="tabular-nums w-36 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white"
            />
            <button
              type="submit"
              className="ui-interactive inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ตั้งแจ้งเตือนราคา</span>
            </button>
          </form>
        </div>

        {feedbackMsg && (
          <div
            role="status"
            className={`mt-3 rounded-xl px-4 py-2.5 text-xs font-medium ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}
      </section>

      {/* ====================================================================
          SECTION 6: Multi-Merchant Price Comparison Table
         ==================================================================== */}
      <section
        id="price-comparison"
        aria-labelledby="comparison-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2
              id="comparison-heading"
              className="text-lg font-bold text-slate-900"
            >
              เปรียบเทียบราคาจากร้านค้า ({offers.length} ข้อเสนอ)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              แสดงราคาสินค้า ค่าจัดส่ง และราคารวมสุทธิเฉพาะร้านค้าที่ยืนยันค่าจัดส่งแล้วเท่านั้น
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span>เฉพาะที่มีสินค้าพร้อมส่ง</span>
            </label>

            <div className="flex items-center gap-1.5">
              <label
                htmlFor="offer-sort-select"
                className="text-xs font-medium text-slate-600"
              >
                เรียงตาม:
              </label>
              <select
                id="offer-sort-select"
                value={offerSort}
                onChange={(e) => setOfferSort(e.target.value as OfferSortOption)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
              >
                <option value="price_asc">ราคาสินค้าต่ำสุด</option>
                <option value="total_price_asc">
                  ราคารวมส่งต่ำสุด (ที่ยืนยันค่าส่งแล้ว)
                </option>
                <option value="updated_desc">อัปเดตล่าสุด</option>
                <option value="merchant_asc">ชื่อร้านค้า (ก-ฮ, A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pr-4">ร้านค้า / สถานะยืนยัน</th>
                <th className="py-3 pr-4">ชื่อรายการที่ขาย & สภาพ</th>
                <th className="py-3 pr-4">สถานะสต็อก</th>
                <th className="py-3 pr-4 text-right">ราคาสินค้า</th>
                <th className="py-3 pr-4 text-right">ค่าจัดส่ง</th>
                <th className="py-3 pr-4 text-right">ราคารวมสุทธิ</th>
                <th className="py-3 pr-4 text-right">ตรวจสอบล่าสุด</th>
                <th className="py-3 text-right">ลิงก์สั่งซื้อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offers.map((offer) => (
                <tr key={offer.id} className="hover:bg-slate-50/80">
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-slate-900">
                      {offer.merchant.name}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      {offer.merchant.verificationStatus === "verified" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>ร้านค้าที่ยืนยันแล้ว</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>สถานะ: {offer.merchant.verificationStatus}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-4 pr-4 max-w-xs">
                    <div className="line-clamp-2 text-xs font-medium text-slate-800">
                      {offer.title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        สภาพ: {offer.condition === "new" ? "สินค้าใหม่ (New)" : offer.condition}
                      </span>
                      {offer.isCheapestByProductPrice && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                          ราคาตั้งต้นต่ำสุด
                        </span>
                      )}
                      {offer.isCheapestByVerifiedTotalPrice && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          ราคารวมส่งคุ้มที่สุด (ยืนยันแล้ว)
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-4 pr-4">
                    {offer.availabilityStatus === "in_stock" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        <span>มีสินค้า</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        <span>{offer.availabilityStatus}</span>
                      </span>
                    )}
                  </td>

                  <td className="py-4 pr-4 text-right tabular-nums font-bold text-slate-900">
                    {formatPriceTHB(offer.price)}
                  </td>

                  <td className="py-4 pr-4 text-right tabular-nums text-xs">
                    {offer.shippingKnown ? (
                      <span
                        className={
                          Number(offer.shippingCost) === 0
                            ? "font-semibold text-emerald-700"
                            : "text-slate-700"
                        }
                      >
                        {formatShippingTHB(offer.shippingCost)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        <span>ไม่ระบุค่าจัดส่ง</span>
                      </span>
                    )}
                  </td>

                  <td className="py-4 pr-4 text-right tabular-nums">
                    {offer.totalPrice !== null ? (
                      <span className="text-base font-bold text-blue-700">
                        {formatPriceTHB(offer.totalPrice)}
                      </span>
                    ) : (
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {formatPriceTHB(offer.price)}
                        </span>{" "}
                        <span>+ ค่าส่งไม่ระบุ</span>
                      </div>
                    )}
                  </td>

                  <td className="py-4 pr-4 text-right tabular-nums text-xs text-slate-500">
                    {new Date(offer.lastCheckedAt).toLocaleString("th-TH", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>

                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleOfferOutboundClick(offer)}
                      className="ui-interactive inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      <span>ไปที่ร้านค้า</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ====================================================================
          SECTION 7: Price History & Buying Recommendation
         ==================================================================== */}
      <section
        id="price-history"
        aria-labelledby="history-heading"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="history-heading" className="text-lg font-bold text-slate-900">
              ประวัติราคาและการวิเคราะห์จังหวะซื้อ (Price History)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              อ้างอิงจากข้อมูลราคาที่บันทึกจริงในระบบ (ไม่สร้างกราฟจำลองย้อนหลังหากไม่มีข้อมูล)
            </p>
          </div>

          <div
            role="group"
            aria-label="เลือกช่วงเวลาประวัติราคา"
            className="flex items-center gap-1 rounded-xl bg-slate-100 p-1"
          >
            {HISTORY_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`ui-interactive rounded-lg px-3 py-1 text-xs font-semibold ${
                  period === p
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p === "7d"
                  ? "7 วัน"
                  : p === "30d"
                    ? "30 วัน"
                    : p === "90d"
                      ? "90 วัน"
                      : "365 วัน"}
              </button>
            ))}
          </div>
        </div>

        {/* Key Historical Stats Cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs font-medium text-slate-500">
              ราคาต่ำสุดปัจจุบัน
            </span>
            <div className="mt-1 tabular-nums text-xl font-bold text-slate-900">
              {formatPriceTHB(history.stats.currentLowestPrice)}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ราคาต่ำสุดในประวัติ ({period})</span>
            </span>
            <div className="mt-1 tabular-nums text-xl font-bold text-emerald-700">
              {formatPriceTHB(history.stats.historicalMinPrice)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ราคาสูงสุดในประวัติ ({period})</span>
            </span>
            <div className="mt-1 tabular-nums text-xl font-bold text-slate-900">
              {formatPriceTHB(history.stats.historicalMaxPrice)}
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <span className="text-xs font-semibold text-blue-800">
              คำแนะนำจังหวะการซื้อ
            </span>
            <div className="mt-1 text-sm font-bold text-blue-950">
              {history.buyingSignal.recommendation === "buy_now"
                ? "แนะนำให้ซื้อตอนนี้ (ราคาต่ำสุด)"
                : history.buyingSignal.recommendation === "wait"
                  ? "แนะนำให้รอก่อน / ตั้งแจ้งเตือน"
                  : history.buyingSignal.recommendation === "typical_price"
                    ? "ราคาอยู่ในเกณฑ์ปกติ"
                    : "รอสะสมข้อมูลประวัติเพิ่ม"}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-blue-800">
              {history.buyingSignal.reason}
            </p>
          </div>
        </div>

        {/* Chart or Honest Empty State */}
        <div className="mt-6">
          {!history.hasSufficientData ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-800">
                ยังไม่มีข้อมูลประวัติราคาเพียงพอสำหรับสร้างกราฟในช่วง {period}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ระบบจะแสดงกราฟเมื่อมีจุดบันทึกการเปลี่ยนแปลงราคาอย่างน้อย 2 วันขึ้นไป โดยไม่จำลองข้อมูลเทียม
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <span>แนวโน้มราคาต่ำสุดรายวัน (THB)</span>
                {history.stats.lastUpdatedAt && (
                  <span className="tabular-nums">
                    อัปเดตข้อมูลล่าสุด:{" "}
                    {new Date(history.stats.lastUpdatedAt).toLocaleString("th-TH")}
                  </span>
                )}
              </div>

              {/* Clean Tabular & Visual Bar/Trend Representation */}
              <div className="grid gap-2">
                {history.dailySeries.map((point) => {
                  const minVal = Number(history.stats.historicalMinPrice ?? point.minPrice);
                  const maxVal = Number(history.stats.historicalMaxPrice ?? point.maxPrice);
                  const span = Math.max(1, maxVal - minVal);
                  const pct = Math.round(
                    30 + ((Number(point.minPrice) - minVal) / span) * 65,
                  );

                  return (
                    <div
                      key={point.date}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="tabular-nums w-24 font-mono text-slate-600">
                        {point.date}
                      </span>
                      <div className="flex-1 rounded-lg bg-slate-200/70 h-6 overflow-hidden flex items-center">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-blue-600 rounded-lg flex items-center justify-end pr-2 text-[11px] font-semibold text-white tabular-nums"
                        >
                          {formatPriceTHB(point.minPrice)}
                        </div>
                      </div>
                      <span className="tabular-nums w-36 text-right text-slate-500">
                        รวมส่ง:{" "}
                        {point.minVerifiedTotalPrice
                          ? formatPriceTHB(point.minVerifiedTotalPrice)
                          : "ไม่ระบุ"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
