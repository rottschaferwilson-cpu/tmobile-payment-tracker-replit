import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";

export default function HomeLanding() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <CreditCard className="w-6 h-6" />
            <span className="text-lg font-bold tracking-tight text-gray-900">
              BillingManager
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="py-24 sm:py-32 bg-gray-50 border-b border-gray-100 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-100/50 rounded-[100%] blur-3xl -z-10 opacity-60"></div>
            
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 max-w-4xl mx-auto leading-[1.1]">
              Professional Billing for <span className="text-blue-600">Local ISPs</span>.
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              A precise, no-nonsense dashboard to manage customer balances, record payments, apply late fees, and keep your accounting organized. Every number you can trust.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 h-14 text-base font-semibold shadow-md">
                  Create an account <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Clear Ledger</h3>
                <p className="text-gray-600 leading-relaxed">
                  Track every charge, payment, and late fee with perfect clarity. A running balance ensures you always know exactly what is owed.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Bulk Actions</h3>
                <p className="text-gray-600 leading-relaxed">
                  Apply late fees to all overdue accounts with a single click. Save hours of manual data entry at the end of the month.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Trustworthy Data</h3>
                <p className="text-gray-600 leading-relaxed">
                  Built to the standard of professional accounting software. Export your data securely to Google Sheets at any time.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t border-gray-100 bg-white text-center">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} BillingManager. For internal use.
        </p>
      </footer>
    </div>
  );
}
