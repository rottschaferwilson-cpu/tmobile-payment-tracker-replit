import { useState } from "react";
import { useApplyLateFees, useGetSpreadsheetUrl, useGetLateFeeSchedule, getListCustomersQueryKey, getGetDashboardQueryKey, getGetLateFeeScheduleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ExternalLink, CalendarClock, CheckCircle2, Clock, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LateFeeResult } from "@workspace/api-client-react";

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function formatNextDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoString));
}

export default function Admin() {
  const { data: sheetInfo, isLoading: sheetLoading } = useGetSpreadsheetUrl();
  const { data: schedule, isLoading: scheduleLoading } = useGetLateFeeSchedule();
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
        queryClient.invalidateQueries({ queryKey: getGetLateFeeScheduleQueryKey() });
        toast({
          title: "Late fees applied",
          description: `Applied to ${data.applied} account${data.applied !== 1 ? "s" : ""}.`,
        });
      },
      onError: () => {
        toast({
          title: "Error applying late fees",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      },
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Tools</h1>
        <p className="text-gray-500 mt-2">System-wide actions and settings.</p>
      </div>

      {/* Scheduler status banner */}
      <Card className="shadow-sm border-blue-200 bg-blue-50">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">Automatic Late Fees Active</p>
                <p className="text-sm text-blue-700">20% fee applied to all positive balances on the 10th of each month.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 text-sm">
              {scheduleLoading ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      <span className="font-medium">Last run:</span>{" "}
                      {schedule?.lastAppliedAt ? formatDate(schedule.lastAppliedAt) : "Never"}
                    </span>
                  </div>
                  <div className="hidden sm:block text-blue-300">·</div>
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <CalendarClock className="w-4 h-4 shrink-0" />
                    <span>
                      <span className="font-medium">Next:</span>{" "}
                      {schedule?.nextScheduledDate ? formatNextDate(schedule.nextScheduledDate) : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual late fee override */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-red-600">
                <CalendarClock className="w-5 h-5" />
                <CardTitle className="text-lg">Run Late Fees Now</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs text-gray-500">Manual override</Badge>
            </div>
            <CardDescription>
              Manually trigger the 20% late fee script outside of its scheduled run.
              The scheduler already runs this automatically on the 10th — use this only if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full font-semibold shadow-sm"
                  disabled={applyLateFees.isPending}
                >
                  {applyLateFees.isPending ? "Processing…" : "Apply Late Fees"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apply Late Fees Now?</AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                    This will charge a <strong>20% late fee</strong> to every customer with a positive balance.
                    <br /><br />
                    This action creates transactions and cannot be bulk-undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleApplyLateFees}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Yes, Apply Fees
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Google Sheets link */}
        <Card className="shadow-sm border-gray-200 bg-gray-50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2 text-green-700">
              <ExternalLink className="w-5 h-5" />
              <CardTitle className="text-lg">Google Sheets</CardTitle>
            </div>
            <CardDescription>
              All data is stored live in your Google Sheet. Edit directly and the app reflects changes immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sheetLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : sheetInfo?.url ? (
              <Button
                asChild
                className="w-full bg-green-700 hover:bg-green-800 text-white font-medium shadow-sm"
              >
                <a href={sheetInfo.url} target="_blank" rel="noopener noreferrer">
                  Open Spreadsheet <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            ) : (
              <div className="p-3 text-sm text-amber-700 bg-yellow-50 border border-yellow-200 rounded text-center">
                Spreadsheet URL not available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Late fee results */}
      {lateFeeResult && (
        <Card className="shadow-sm border-green-200 bg-white overflow-hidden">
          <div className="bg-green-50 p-4 border-b border-green-100 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-green-900 text-lg">Late Fees Applied</h3>
              <p className="text-green-800 text-sm mt-1">
                Checked {lateFeeResult.applied + lateFeeResult.skipped} accounts —{" "}
                applied fees to <strong>{lateFeeResult.applied}</strong>,
                skipped <strong>{lateFeeResult.skipped}</strong> (zero or negative balance).
                Total added:{" "}
                <strong>{formatCurrency(lateFeeResult.totalFeesAdded)}</strong>.
              </p>
            </div>
          </div>
          <CardContent className="p-0">
            {lateFeeResult.details && lateFeeResult.details.length > 0 ? (
              <Table>
                <TableHeader className="bg-gray-50 border-b border-gray-200">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700">Customer</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Balance Before</TableHead>
                    <TableHead className="text-right font-semibold text-red-700">Fee Added (20%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lateFeeResult.details.map((detail) => (
                    <TableRow key={detail.customerId} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-900">{detail.customerName}</TableCell>
                      <TableCell className="text-right text-gray-600">{formatCurrency(detail.balance)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        +{formatCurrency(detail.feeAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No accounts were eligible for late fees (all balances are zero or negative).
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
