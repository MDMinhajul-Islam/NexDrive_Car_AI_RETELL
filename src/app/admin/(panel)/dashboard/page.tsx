import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/site/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

// Built in the next phase, once the SQL in supabase/proposed has been applied.
export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader title="Dashboard" description="Booking and inventory analytics." />
      <EmptyState
        icon={DatabaseZap}
        title="Waiting for database setup"
        description="Dashboard charts and KPIs will appear here once the SQL files in supabase/proposed have been applied."
      />
    </>
  );
}
