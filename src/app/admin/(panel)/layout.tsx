import type { Metadata } from "next";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | NexDrive Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-muted/40">
      <AdminSidebar email={admin.email} />
      <AdminMobileNav email={admin.email} />
      <main id="main" className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
