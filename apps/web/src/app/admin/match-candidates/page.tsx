"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import type { MatchReviewStatus } from "@pricelens/shared";
import { browserApiClient } from "@/lib/client-api";

export default function AdminMatchCandidatesPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<
    MatchReviewStatus | undefined
  >("pending");

  const candidatesQuery = useQuery({
    queryKey: ["admin-match-candidates", filterStatus],
    queryFn: async () =>
      (await browserApiClient.getMatchCandidates(filterStatus)).data,
  });

  const approveMutation = useMutation({
    mutationFn: async (params: { id: string; productId?: string }) => {
      await browserApiClient.approveMatchCandidate(params.id, params.productId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-match-candidates"],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-data-quality"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await browserApiClient.rejectMatchCandidate(
        id,
        "Rejected by administrator in matching review queue",
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-match-candidates"],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-data-quality"] });
    },
  });

  const candidates = candidatesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            คิวตรวจสอบและอนุมัติการจับคู่สินค้า (Product Matching Review Queue)
          </h2>
          <p className="text-xs text-slate-500">
            รายการที่ไม่มีรหัส GTIN/EAN หรือ MPN จะถูกกักไว้ในคิวนี้เพื่อให้ผู้ดูแลระบบตรวจสอบก่อนนำไปรวมกับสินค้าหลัก
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
          {(["pending", "approved", "rejected"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                filterStatus === st
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st === "pending"
                ? "รอตรวจสอบ (Pending)"
                : st === "approved"
                  ? "อนุมัติแล้ว (Approved)"
                  : "ปฏิเสธแล้ว (Rejected)"}
            </button>
          ))}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-500">
          ไม่มีรายการในสถานะ {filterStatus}
        </div>
      ) : (
        <div className="grid gap-4">
          {candidates.map((cand) => {
            const data = cand.candidateData ?? {};
            return (
              <div
                key={cand.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-100 px-2.5 py-1 tabular-nums text-xs font-bold text-amber-900">
                      ความมั่นใจ (Confidence): {cand.confidenceScore}%
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      External ID: {cand.externalProductId} ({cand.sourceName})
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      cand.reviewStatus === "pending"
                        ? "bg-amber-50 text-amber-800"
                        : cand.reviewStatus === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {cand.reviewStatus}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    ชื่อรายการจากแหล่งข้อมูล: {String(data.title ?? "-")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    ร้านค้า: {String(data.merchantName ?? "-")} &bull; ราคา:{" "}
                    <strong className="tabular-nums">
                      ฿{String(data.price ?? "-")}
                    </strong>{" "}
                    &bull; ค่าจัดส่ง:{" "}
                    {data.shippingCost === null || data.shippingCost === undefined
                      ? "ไม่ระบุ (Unknown)"
                      : `฿${String(data.shippingCost)}`}
                  </p>
                </div>

                {/* Matching Reasons */}
                <div className="flex flex-wrap gap-1.5">
                  {cand.matchingReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                {cand.reviewStatus === "pending" && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={!cand.productId || approveMutation.isPending}
                      onClick={() =>
                        approveMutation.mutate({
                          id: cand.id,
                          productId: cand.productId ?? undefined,
                        })
                      }
                      className="ui-interactive inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>อนุมัติและสร้างข้อเสนอราคา (Approve)</span>
                    </button>

                    <button
                      type="button"
                      disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(cand.id)}
                      className="ui-interactive inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>ปฏิเสธการจับคู่ (Reject)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
