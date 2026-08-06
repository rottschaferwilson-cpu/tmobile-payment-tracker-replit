/**
 * Customer portal — billing history + payment submission.
 * No login required. Customer arrives here after picking their name.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, AlertCircle, Wifi, CheckCircle2 } from "lucide-react";

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

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  planName: string;
  monthlyRate: number;
  status: string;
  notes: string | null;
  balance: number;
  transactions: Transaction[];
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function usePortalCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ["portal-customer", id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/portal/customers/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });
}

// ── Payment form schema ───────────────────────────────────────────────────────

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than $0"),
  date: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      note: "",
    },
  });

  // Pre-fill amount with balance when dialog opens
  const handleOpenDialog = () => {
    form.reset({
      amount: customer && customer.balance > 0 ? customer.balance : 0,
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setSuccessAmount(null);
    setDialogOpen(true);
  };

  const submitPayment = useMutation({
    mutationFn: async (values: z.infer<typeof paymentSchema>) => {
      const res = await fetch(`${BASE}/api/portal/customers/${id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to submit payment");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setSuccessAmount(variables.amount);
      queryClient.invalidateQueries({ queryKey: ["portal-customer", id] });
      queryClient.invalidateQueries({ queryKey: ["portal-customers"] });
      toast({ title: "Payment recorded!", description: `${formatCurrency(variables.amount)} logged successfully.` });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    },
  });

  // Build running balance (oldest → newest, displayed newest first)
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

  // ── Error / loading states ─────────────────────────────────────────────────

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
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">
              {isLoading ? <Skeleton className="h-5 w-32 inline-block" /> : customer?.name}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Success banner */}
        {successAmount !== null && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
            <p className="font-medium">
              Payment of <strong>{formatCurrency(successAmount)}</strong> recorded. Thank you!
            </p>
          </div>
        )}

        {/* Balance card */}
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
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
                    (customer?.balance ?? 0) > 0 ? "Amount owed" :
                    (customer?.balance ?? 0) < 0 ? "You have a credit on your account" :
                    "Your account is settled — thank you!"}
                </p>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={handleOpenDialog}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold h-12 px-6 shadow-sm shrink-0"
                    disabled={isLoading}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Record a Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Record a Payment</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((v) => submitPayment.mutate(v))}
                      className="space-y-5 pt-2"
                    >
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount Paid ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Cash payment, check #1234" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 font-semibold"
                        disabled={submitPayment.isPending}
                      >
                        {submitPayment.isPending ? "Saving…" : "Submit Payment"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Plan info */}
            {!isLoading && customer && (
              <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-600">
                <span><span className="font-medium text-gray-800">Plan:</span> {customer.planName}</span>
                <span><span className="font-medium text-gray-800">Monthly rate:</span> {formatCurrency(customer.monthlyRate)}</span>
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
