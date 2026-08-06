/**
 * Customer portal — name picker.
 * No login required. Customer picks their name and goes to their billing detail.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronRight, Wifi } from "lucide-react";

interface CustomerSummary {
  id: string;
  name: string;
  balance: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function usePortalCustomers() {
  return useQuery<CustomerSummary[]>({
    queryKey: ["portal-customers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/portal/customers`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function Portal() {
  const { data: customers, isLoading, error } = usePortalCustomers();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-5">
          <Wifi className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Billing Portal</h1>
        <p className="text-gray-500 mt-2 text-base">Select your name to view your balance and billing history.</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Unable to load customers. Please try again.
          </div>
        )}

        {customers?.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/portal/${c.id}`)}
            className="w-full group"
          >
            <Card className="border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-150 cursor-pointer bg-white">
              <CardContent className="flex items-center justify-between p-5">
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-lg leading-tight">{c.name}</p>
                  <p className={`text-sm font-medium mt-0.5 ${
                    c.balance > 0 ? "text-red-600" :
                    c.balance < 0 ? "text-green-600" :
                    "text-gray-500"
                  }`}>
                    {c.balance > 0
                      ? `Balance due: ${formatCurrency(c.balance)}`
                      : c.balance < 0
                      ? `Credit: ${formatCurrency(Math.abs(c.balance))}`
                      : "Account settled"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </button>
        ))}

        {customers?.length === 0 && !isLoading && (
          <p className="text-center text-gray-500 py-8">No accounts found.</p>
        )}
      </div>

      <p className="mt-10 text-xs text-gray-400">
        Need help? Contact your provider.
      </p>
    </div>
  );
}
