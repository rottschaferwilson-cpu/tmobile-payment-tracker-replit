/**
 * Customer portal — read-only billing history.
 * No login required. Shows balance and transaction history only.
 * Payments must be reported to the admin.
 */
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, Wifi, Phone } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  customerId: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface CustomerPortalData {
  id: string;
  name: string;
  planName: string;
  monthlyRate: number;
  status: string;
  balance: number;
  transactions: Transaction[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function usePortalCustomer(id: string) {
  return useQuery<CustomerPortalData>({
    queryKey: ["portal-customer", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/portal/customers/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function typeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeColor(type: string) {
  switch (type) {
    case "payment": return "bg-green-100 text-green-700";
    case "late_fee":
    case "manual_late_fee": return "bg-red-100 text-red-700";
    case "service": return "bg-blue-100 text-blue-700";
    case "equipment": return "bg-purple-100 text-purple-700";
    case "one_time": return "bg-orange-100 text-orange-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: customer, isLoading, error } = usePortalCustomer(id!);

  // Build running balance — oldest first, display newest first
  const txWithBalance = customer?.transactions
    ? [...customer.transactions]
        .sort(
          (a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime() ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .reduce((acc, tx) => {
          const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
          const delta = tx.type === "payment" ? -tx.amount : tx.amount;
          acc.push({ ...tx, runningBalance: prev + delta });
          return acc;
        }, [] as (Transaction & { runningBalance: number })[])
        .reverse()
    : [];

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4">
        <div className="flex items-center gap-3 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 max-w-sm w-full">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-semibold">Account not found</p>
            <button onClick={() => navigate("/portal")} className="text-sm underline mt-1">
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/portal")}
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2 ml-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">
              {isLoading ? <Skeleton className="h-5 w-32 inline-block" /> : customer?.name}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Balance card */}
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-1">Current Balance</p>
                {isLoading ? (
                  <Skeleton className="h-12 w-36" />
                ) : (
                  <p className={`text-4xl font-extrabold tracking-tight ${
                    (customer?.balance ?? 0) > 0
                      ? "text-red-600"
                      : (customer?.balance ?? 0) < 0
                      ? "text-green-600"
                      : "text-gray-900"
                  }`}>
                    {formatCurrency(Math.abs(customer?.balance ?? 0))}
                    {(customer?.balance ?? 0) < 0 && (
                      <span className="text-xl ml-1.5 text-green-700">CR</span>
                    )}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {isLoading ? "" :
                    (customer?.balance ?? 0) > 0 ? "Amount currently owed" :
                    (customer?.balance ?? 0) < 0 ? "You have a credit on your account" :
                    "Your account is settled — thank you!"}
                </p>
              </div>

              {!isLoading && customer && (
                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 space-y-1 min-w-[180px]">
                  <p><span className="font-medium text-gray-800">Plan:</span> {customer.planName}</p>
                  <p><span className="font-medium text-gray-800">Monthly rate:</span> {formatCurrency(customer.monthlyRate)}</p>
                </div>
              )}
            </div>

            {/* Payment instructions */}
            {!isLoading && (customer?.balance ?? 0) > 0 && (
              <div className="mt-5 pt-5 border-t border-gray-100 flex items-start gap-3 text-sm text-gray-600 bg-blue-50 rounded-lg p-4">
                <Phone className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                <p>
                  To make a payment, please contact your provider directly. Your payment will be reflected here once recorded.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction history */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Billing History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700 w-[110px]">Date</TableHead>
                    <TableHead className="font-semibold text-gray-700">Type</TableHead>
                    <TableHead className="font-semibold text-gray-700">Description</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Amount</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 bg-gray-100 border-l border-gray-200">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    : txWithBalance.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                          No transactions on record yet.
                        </TableCell>
                      </TableRow>
                    )
                    : txWithBalance.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm text-gray-900 font-medium">
                          {format(new Date(tx.date + "T12:00:00"), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs font-semibold border-0 ${typeColor(tx.type)}`}
                          >
                            {typeLabel(tx.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-700 text-sm">{tx.description}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold text-sm ${tx.type === "payment" ? "text-green-600" : "text-gray-900"}`}>
                            {tx.type === "payment" ? "−" : "+"}{formatCurrency(tx.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right border-l border-gray-100 bg-gray-50/30">
                          <span className={`font-bold text-sm ${
                            tx.runningBalance > 0 ? "text-red-600" :
                            tx.runningBalance < 0 ? "text-green-600" :
                            "text-gray-900"
                          }`}>
                            {formatCurrency(Math.abs(tx.runningBalance))}
                            {tx.runningBalance < 0 && " CR"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
