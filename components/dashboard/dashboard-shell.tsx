"use client";

import { GlobalFilterHost } from "@/components/dashboard/global-filter-host";
import { Navbar } from "@/components/dashboard/navbar";
import { Sidebar } from "@/components/dashboard/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh overflow-x-clip overflow-y-hidden bg-white text-[#212529]">
      <Sidebar />
      <div className="flex h-dvh flex-col pl-14 sm:pl-[68px]">
        <Navbar />
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fa] px-3 py-3 sm:px-4 sm:py-3.5 lg:px-6 lg:py-4 2xl:px-8">
          <div className="flex h-full min-h-0 w-full flex-col">
            {children}
          </div>
          <GlobalFilterHost />
        </main>
      </div>
    </div>
  );
}
