import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Admin", href: "/admin", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col md:flex-row">
      <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-200 shrink-0">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white">
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">Internet Billing</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-gray-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user?.imageUrl} alt={user?.fullName || "User"} className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
