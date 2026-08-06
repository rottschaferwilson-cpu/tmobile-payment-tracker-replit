/**
 * Members — landing page shown to every signed-in user.
 * Displays all members as cards with name + current balance.
 * Admin gets an "Add Member" button.
 */
import { useState } from "react";
import { useListCustomers, useCreateCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ChevronRight, Plus, Wifi } from "lucide-react";

const ADMIN_EMAIL = "rottschaferwilson@gmail.com";

const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  planName: z.string().min(1, "Plan name is required"),
  monthlyRate: z.coerce.number().min(0, "Rate must be positive"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  notes: z.string().optional(),
});

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function Members() {
  const { data: customers, isLoading, error } = useListCustomers();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);

  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;
  const createCustomer = useCreateCustomer();

  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "", address: "", phone: "", planName: "",
      monthlyRate: 0, status: "active", notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof memberSchema>) => {
    createCustomer.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Member added" });
          setAddOpen(false);
          form.reset();
        },
        onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
      }
    );
  };

  // Sort: balance descending (highest owed first), then name
  const sorted = [...(customers ?? [])].sort((a, b) =>
    b.balance - a.balance || a.name.localeCompare(b.name)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Members</h1>
          <p className="text-gray-500 mt-1 text-sm">Select a member to view their account.</p>
        </div>
        {isAdmin && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Address</FormLabel>
                      <FormControl><Input placeholder="123 Main St" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input placeholder="(555) 123-4567" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
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
                    <FormField control={form.control} name="planName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan Name</FormLabel>
                        <FormControl><Input placeholder="Home Internet" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="monthlyRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rate ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={createCustomer.isPending}>
                      {createCustomer.isPending ? "Saving…" : "Save Member"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Unable to load members. Please try again.
        </div>
      )}

      {/* Member cards */}
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          : sorted.map((member) => (
              <button
                key={member.id}
                onClick={() => navigate(`/customers/${member.id}`)}
                className="w-full group text-left"
              >
                <Card className="border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-150 bg-white">
                  <CardContent className="flex items-center gap-4 p-5">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Wifi className="w-5 h-5 text-blue-600" />
                    </div>

                    {/* Name + plan */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-lg leading-tight">{member.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{member.planName} · {formatCurrency(member.monthlyRate)}/mo</p>
                    </div>

                    {/* Balance */}
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-extrabold tracking-tight ${
                        member.balance > 0 ? "text-red-600"
                        : member.balance < 0 ? "text-green-600"
                        : "text-gray-400"
                      }`}>
                        {member.balance === 0
                          ? "Paid"
                          : `${formatCurrency(Math.abs(member.balance))}${member.balance < 0 ? " CR" : ""}`}
                      </p>
                      {member.balance > 0 && (
                        <p className="text-xs text-red-400 mt-0.5">Balance due</p>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))}
      </div>
    </div>
  );
}
