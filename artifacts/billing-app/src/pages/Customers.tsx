import { useState } from "react";
import { Link } from "wouter";
import {
  useListCustomers,
  useCreateCustomer,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  planName: z.string().min(1, "Plan name is required"),
  monthlyRate: z.coerce.number().min(0, "Rate must be positive"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  notes: z.string().optional(),
});

export default function Customers() {
  const { data: customers, isLoading } = useListCustomers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "balance">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const createCustomer = useCreateCustomer();

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      planName: "",
      monthlyRate: 0,
      status: "active",
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof customerSchema>) => {
    createCustomer.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
          toast({ title: "Customer added successfully" });
          setIsAddOpen(false);
          form.reset();
        },
        onError: () => {
          toast({ title: "Failed to add customer", variant: "destructive" });
        },
      }
    );
  };

  const handleSort = (field: "name" | "balance") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredCustomers = customers
    ?.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a.balance - b.balance;
      }
      return sortDir === "asc" ? comparison : -comparison;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Active</Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-0">Inactive</Badge>;
      case "suspended":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-0">Suspended</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Customers</h1>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search customers..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St, Apt 4B" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="planName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Gigabit Fiber" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="monthlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Rate ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createCustomer.isPending} className="w-full sm:w-auto">
                      {createCustomer.isPending ? "Saving..." : "Save Customer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("name")} className="-ml-4 font-semibold text-gray-700">
                  Customer <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold text-gray-700">Plan</TableHead>
              <TableHead className="font-semibold text-gray-700">Status</TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort("balance")} className="-mr-4 font-semibold text-gray-700">
                  Balance <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[60px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredCustomers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-gray-500">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers?.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-gray-50 cursor-pointer group">
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="block">
                      <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {customer.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px] sm:max-w-[300px]">
                        {customer.address}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="block">
                      <div className="text-sm text-gray-900">{customer.planName}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(customer.monthlyRate)}/mo</div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="block">
                      {getStatusBadge(customer.status)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/customers/${customer.id}`} className="block">
                      <div className={`font-semibold text-base ${
                        customer.balance > 0 ? "text-red-600" :
                        customer.balance < 0 ? "text-green-600" :
                        "text-gray-900"
                      }`}>
                        {formatCurrency(Math.abs(customer.balance))}
                        {customer.balance < 0 && " CR"}
                      </div>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
