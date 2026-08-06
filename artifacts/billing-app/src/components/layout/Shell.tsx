import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { Users, Settings, LogOut, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

const ADMIN_EMAIL = "rottschaferwilson@gmail.com";

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const isAdmin = user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL;

  const navigation = [
    { name: "Members", href: "/members", icon: Users },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Wifi className="w-4 h-4" />
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">Internet Billing</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {navigation.map((item) => {
            const isActive =
              location === item.href ||
              (item.href === "/members" && location.startsWith("/customers"));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName || "User"}
                className="w-8 h-8 rounded-full bg-gray-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName || "User"}</p>
              <p className="text-xs text-gray-500 truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
