import { useState } from "react";
import { useParams, Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  useGetCustomer,
  useAddTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  useUpdateCustomer,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, MapPin, Phone, Settings, Trash2, AlertCircle,
  PlusCircle, CreditCard, Edit2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ADMIN_EMAIL = "rottschaferwilson@gmail.com";

const transactionSchema = z.object({
  type: z.enum(["service", "equipment", "one_time", "late_fee", "manual_late_fee", "payment"]),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  date: z.string(),
});

const customerUpdateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  planName: z.string().min(1, "Plan name is required"),
  monthlyRate: z.coerce.number().min(0, "Rate must be positive"),
  status: z.enum(["active", "inactive", "suspended"]),
  notes: z.string().optional(),
});

export default function CustomerDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const { data: customer, isLoading, error } = useGetCustomer(id!);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [txTypePreset, setTxTypePreset] = useState<"service" | "equipment" | "one_time" | "late_fee" | "payment">("payment");
  const [txEditDialogOpen, setTxEditDialogOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const addTransaction = useAddTransaction();
  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();
  const updateCustomer = useUpdateCustomer();

  const txForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "payment",
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
    },
  });

  const txEditForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "payment",
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
    },
  });

  const editForm = useForm<z.infer<typeof customerUpdateSchema>>({
    resolver: zodResolver(customerUpdateSchema),
    defaultValues: {
      name: "", address: "", phone: "", planName: "",
      monthlyRate: 0, status: "active", notes: "",
    },
  });

  if (customer && editForm.getValues("name") === "") {
    editForm.reset({
      name: customer.name,
      address: customer.address,
      phone: customer.phone,
      planName: customer.planName,
      monthlyRate: customer.monthlyRate,
      status: customer.status,
      notes: customer.notes || "",
    });
  }

  const handleOpenTxDialog = (type: typeof txTypePreset) => {
    setTxTypePreset(type);
    let description = "";
    let amount = 0;
    if (type === "service") {
      description = `Monthly Service: ${customer?.planName}`;
      amount = customer?.monthlyRate || 0;
    } else if (type === "late_fee") {
      description = "Late Payment Fee";
      amount = customer ? +(customer.balance * 0.2).toFixed(2) : 0;
    } else if (type === "payment") {
      description = "Payment Received";
      amount = customer && customer.balance > 0 ? customer.balance : 0;
    }
    txForm.reset({ type, description, amount, date: new Date().toISOString().split("T")[0] });
    setTxDialogOpen(true);
  };

  const onTxSubmit = (values: z.infer<typeof transactionSchema>) => {
    if (!id) return;
    addTransaction.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
          toast({ title: values.type === "payment" ? "Payment recorded" : "Transaction added" });
          setTxDialogOpen(false);
        },
        onError: () => toast({ title: "Failed to save transaction", variant: "destructive" }),
      }
    );
  };

  const onEditSubmit = (values: z.infer<typeof customerUpdateSchema>) => {
    if (!id) return;
    updateCustomer.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
          toast({ title: "Member updated" });
          setEditDialogOpen(false);
        },
        onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
      }
    );
  };

  const handleOpenTxEditDialog = (tx: { id: string; type: string; description: string; amount: number; date: string }) => {
    setEditingTxId(tx.id);
    txEditForm.reset({
      type: tx.type as z.infer<typeof transactionSchema>["type"],
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
    });
    setTxEditDialogOpen(true);
  };

  const onTxEditSubmit = (values: z.infer<typeof transactionSchema>) => {
    if (!id || !editingTxId) return;
    updateTransaction.mutate(
      { id, txId: editingTxId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
          toast({ title: "Transaction updated" });
          setTxEditDialogOpen(false);
          setEditingTxId(null);
        },
        onError: () => toast({ title: "Failed to update transaction", variant: "destructive" }),
      }
    );
  };

  const handleDeleteTx = (txId: string) => {
    if (!id) return;
    deleteTransaction.mutate(
      { id, txId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
          toast({ title: "Transaction deleted" });
        },
        onError: () => toast({ title: "Failed to delete transaction", variant: "destructive" }),
      }
    );
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "payment": return "bg-green-100 text-green-700";
      case "late_fee":
      case "manual_late_fee": return "bg-red-100 text-red-700";
      case "service": return "bg-blue-100 text-blue-700";
      case "equipment": return "bg-purple-100 text-purple-700";
      case "one_time": return "bg-orange-100 text-orange-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (error) {
    return (
      <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <h3 className="font-semibold text-lg">Member not found</h3>
        <Link href="/members" className="text-blue-600 hover:underline mt-2 inline-block">
          Return to members list
        </Link>
      </div>
    );
  }

  const transactionsWithRunningBalance = customer?.transactions
    ? [...customer.transactions]
        .sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime() ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .reduce((acc, tx) => {
          const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
          const delta = tx.type === "payment" ? -tx.amount : tx.amount;
          acc.push({ ...tx, runningBalance: prev + delta });
          return acc;
        }, [] as any[])
        .reverse()
    : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/members">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex-1 truncate">
          {isLoading ? <Skeleton className="h-8 w-64" /> : customer?.name}
        </h1>
        {customer && (
          <Badge className={`text-sm py-1 px-3 ${
            customer.status === "active" ? "bg-green-100 text-green-800" :
            customer.status === "inactive" ? "bg-gray-100 text-gray-800" :
            "bg-yellow-100 text-yellow-800"
          }`}>
            {customer.status.toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Info card — admin can edit */}
        <Card className="md:col-span-2 shadow-sm border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Member Information</CardTitle>
            {isAdmin && (
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1" disabled={isLoading}>
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Edit Member</DialogTitle>
                  </DialogHeader>
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
                      <FormField control={editForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="address" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={editForm.control} name="status" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="planName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={editForm.control} name="monthlyRate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate ($)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={updateCustomer.isPending}>
                          {updateCustomer.isPending ? "Saving…" : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-gray-700">{customer?.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{customer?.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-gray-400 shrink-0" />
                  <span className="text-gray-700">
                    <span className="font-medium text-gray-900">{customer?.planName}</span>
                    <span className="text-gray-500 ml-2">({formatCurrency(customer?.monthlyRate || 0)}/mo)</span>
                  </span>
                </div>
                {customer?.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 bg-yellow-50/50 p-3 rounded">
                    <strong>Notes:</strong> {customer.notes}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Balance + payment */}
        <Card className="shadow-sm border-gray-200 bg-gray-50">
          <CardHeader>
            <CardTitle className="text-lg">Current Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            {isLoading ? (
              <Skeleton className="h-12 w-[150px]" />
            ) : (
              <div className={`text-4xl font-extrabold tracking-tight ${
                (customer?.balance || 0) > 0 ? "text-red-600" :
                (customer?.balance || 0) < 0 ? "text-green-600" :
                "text-gray-900"
              }`}>
                {formatCurrency(Math.abs(customer?.balance || 0))}
                {(customer?.balance || 0) < 0 && <span className="text-xl ml-1 text-green-700">CR</span>}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              {(customer?.balance || 0) > 0 ? "Amount owed" :
               (customer?.balance || 0) < 0 ? "Account has a credit" :
               "Account is settled"}
            </p>

            {/* Record Payment — visible to all users */}
            <div className="mt-8 w-full">
              <Button
                onClick={() => handleOpenTxDialog("payment")}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-12 shadow-sm"
                disabled={isLoading}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Record Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>

          {/* Admin-only: add charges */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleOpenTxDialog("service")} className="text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100">
                <PlusCircle className="w-4 h-4 mr-1.5" /> Service
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenTxDialog("equipment")} className="text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100">
                <PlusCircle className="w-4 h-4 mr-1.5" /> Equipment
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenTxDialog("one_time")} className="text-orange-700 border-orange-200 bg-orange-50 hover:bg-orange-100">
                <PlusCircle className="w-4 h-4 mr-1.5" /> One-Time
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenTxDialog("late_fee")} className="text-red-700 border-red-200 bg-red-50 hover:bg-red-100">
                <PlusCircle className="w-4 h-4 mr-1.5" /> Late Fee
              </Button>
            </div>
          )}
        </div>

        {/* Transaction dialog */}
        <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {txTypePreset === "payment" ? "Record Payment" : "Add Charge"}
              </DialogTitle>
            </DialogHeader>
            <Form {...txForm}>
              <form onSubmit={txForm.handleSubmit(onTxSubmit)} className="space-y-4 pt-4">
                {isAdmin && (
                  <FormField control={txForm.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="service">Service Charge</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                          <SelectItem value="one_time">One-Time Charge</SelectItem>
                          <SelectItem value="late_fee">Late Fee</SelectItem>
                          <SelectItem value="payment">Payment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={txForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={txForm.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ($)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={txForm.control} name="date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={addTransaction.isPending} className="w-full sm:w-auto">
                    {addTransaction.isPending ? "Saving…" : txTypePreset === "payment" ? "Record Payment" : "Save Transaction"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit transaction dialog */}
        <Dialog open={txEditDialogOpen} onOpenChange={setTxEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
            </DialogHeader>
            <Form {...txEditForm}>
              <form onSubmit={txEditForm.handleSubmit(onTxEditSubmit)} className="space-y-4 pt-4">
                <FormField control={txEditForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="service">Service Charge</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="one_time">One-Time Charge</SelectItem>
                        <SelectItem value="late_fee">Late Fee</SelectItem>
                        <SelectItem value="manual_late_fee">Manual Late Fee</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={txEditForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={txEditForm.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ($)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={txEditForm.control} name="date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateTransaction.isPending} className="w-full sm:w-auto">
                    {updateTransaction.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[120px] font-semibold text-gray-700">Date</TableHead>
                <TableHead className="font-semibold text-gray-700">Type</TableHead>
                <TableHead className="font-semibold text-gray-700">Description</TableHead>
                <TableHead className="text-right font-semibold text-gray-700">Amount</TableHead>
                <TableHead className="text-right font-semibold text-gray-700 border-l border-gray-200 bg-gray-100">Balance</TableHead>
                {isAdmin && <TableHead className="w-[90px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                    {isAdmin && <TableCell />}
                  </TableRow>
                ))
              ) : transactionsWithRunningBalance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-gray-500 bg-gray-50/50">
                    No transactions recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                transactionsWithRunningBalance.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm font-medium text-gray-900">
                      {format(new Date(tx.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs font-semibold border-0 ${getTypeColor(tx.type)}`}>
                        {tx.type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-700">{tx.description}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${tx.type === "payment" ? "text-green-600" : "text-gray-900"}`}>
                        {tx.type === "payment" ? "-" : ""}{formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right border-l border-gray-100 bg-gray-50/30">
                      <span className={`font-bold ${tx.runningBalance > 0 ? "text-red-600" : tx.runningBalance < 0 ? "text-green-600" : "text-gray-900"}`}>
                        {formatCurrency(Math.abs(tx.runningBalance))}
                        {tx.runningBalance < 0 && " CR"}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => handleOpenTxEditDialog(tx)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete this {tx.type.replace(/_/g, " ")} for {formatCurrency(tx.amount)}? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTx(tx.id)} className="bg-red-600 hover:bg-red-700">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
