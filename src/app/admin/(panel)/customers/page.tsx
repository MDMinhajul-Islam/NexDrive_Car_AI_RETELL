import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/site/empty-state";

export const metadata: Metadata = { title: "Customers" };

// Built in the next phase, once the SQL in supabase/proposed has been applied.
export default function AdminCustomersPage() {
  return (
    <>
      <AdminPageHeader title="Customers" description="Customer records." />
      <EmptyState
        icon={DatabaseZap}
        title="Waiting for database setup"
        description="The customers table will appear here once the SQL files in supabase/proposed have been applied."
      />
    </>
  );
}
