import { useState } from "react";
import { useApplyLateFees, useGetSpreadsheetUrl, getListCustomersQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, CalendarClock, Settings as SettingsIcon, ServerCrash, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LateFeeResult } from "@workspace/api-client-react";

export default function Admin() {
  const { data: sheetInfo, isLoading: sheetLoading } = useGetSpreadsheetUrl();
  const applyLateFees = useApplyLateFees();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [lateFeeResult, setLateFeeResult] = useState<LateFeeResult | null>(null);

  const handleApplyLateFees = () => {
    applyLateFees.mutate(undefined, {
      onSuccess: (data) => {
        setLateFeeResult(data);
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        toast({
          title: "Late fees applied",
          description: `Successfully applied to ${data.applied} accounts.`,
        });
      },
      onError: () => {
        toast({
          title: "Error applying late fees",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Tools</h1>
        <p className="text-gray-500 mt-2">Manage system-wide actions and database exports.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2 text-red-600">
              <CalendarClock className="w-5 h-5" />
              <CardTitle className="text-lg">Monthly Late Fees</CardTitle>
            </div>
            <CardDescription>
              Apply a standard 20% late fee to all active accounts with a positive balance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full font-semibold shadow-sm" disabled={applyLateFees.isPending}>
                  {applyLateFees.isPending ? "Processing..." : "Run Late Fee Script"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apply System-Wide Late Fees?</AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                    This will find all customers with an outstanding balance &gt; 0 and apply a <strong>20% Late Fee</strong> transaction to their account immediately.
                    <br /><br />
                    This action creates transactions and cannot be bulk-undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApplyLateFees} className="bg-red-600 hover:bg-red-700">
                    Yes, Apply Fees
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200 bg-gray-50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2 text-green-700">
              <ExternalLink className="w-5 h-5" />
              <CardTitle className="text-lg">Google Sheets Sync</CardTitle>
            </div>
            <CardDescription>
              View the raw database records synced to Google Sheets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sheetLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : sheetInfo?.url ? (
              <Button asChild className="w-full bg-green-700 hover:bg-green-800 text-white font-medium shadow-sm">
                <a href={sheetInfo.url} target="_blank" rel="noopener noreferrer">
                  Open Database Spreadsheet <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            ) : (
              <div className="p-3 text-sm text-amber-700 bg-yellow-50 border border-yellow-200 rounded text-center">
                Spreadsheet URL not configured in API.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {lateFeeResult && (
        <Card className="shadow-sm border-green-200 bg-white overflow-hidden">
          <div className="bg-green-50 p-4 border-b border-green-100 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-green-900 text-lg">Late Fees Applied Successfully</h3>
              <p className="text-green-800 text-sm mt-1">
                Processed {lateFeeResult.applied + lateFeeResult.skipped} accounts. 
                Applied fees to {lateFeeResult.applied} accounts. 
                Total generated revenue: <strong>{formatCurrency(lateFeeResult.totalFeesAdded)}</strong>.
              </p>
            </div>
          </div>
          <CardContent className="p-0">
            {lateFeeResult.details && lateFeeResult.details.length > 0 ? (
              <Table>
                <TableHeader className="bg-gray-50 border-b border-gray-200">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Prior Balance</TableHead>
                    <TableHead className="text-right font-semibold text-red-700">+ Fee Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lateFeeResult.details.map((detail) => (
                    <TableRow key={detail.customerId} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-900">{detail.customerName}</TableCell>
                      <TableCell className="text-right text-gray-600">{formatCurrency(detail.balance)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{formatCurrency(detail.feeAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No accounts were eligible for late fees.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
