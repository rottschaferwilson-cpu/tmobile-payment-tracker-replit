import { useGetDashboard } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  DollarSign,
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px] mb-2" />
                <Skeleton className="h-4 w-[80px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <h3 className="font-semibold text-lg">Failed to load dashboard</h3>
        <p className="text-sm">Please try again later.</p>
      </div>
    );
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <Link href="/customers">
          <Button variant="outline" className="gap-2">
            View All Customers <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Outstanding</CardTitle>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(dashboard.totalOutstanding)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              From {dashboard.customersWithBalance} accounts
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Customers</CardTitle>
            <Activity className="w-4 h-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {dashboard.activeCustomers}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Out of {dashboard.totalCustomers} total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Accounts in Arrears</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {dashboard.customersWithBalance}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customers owing money
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Accounts in Credit</CardTitle>
            <TrendingDown className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {dashboard.customersWithNegativeBalance}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customers with prepaid balance
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-gray-200 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Recent Transactions</CardTitle>
            <CardDescription>Latest billing activity across all accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.recentTransactions.length === 0 ? (
              <div className="py-12 text-center text-gray-500 border border-dashed rounded-lg bg-gray-50">
                No recent transactions found.
              </div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-md ${getTypeColor(tx.type)}`}>
                        {tx.type === 'payment' ? <TrendingDown className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                      </div>
                      <div>
                        <Link href={`/customers/${tx.customerId}`} className="font-medium text-gray-900 hover:text-blue-600 hover:underline">
                          {tx.customerName}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className={`text-[10px] uppercase font-semibold border-0 ${getTypeColor(tx.type)}`}>
                            {tx.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(tx.date), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${tx.type === 'payment' ? 'text-green-600' : 'text-gray-900'}`}>
                        {tx.type === 'payment' ? '-' : ''}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
