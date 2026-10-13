import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/site/empty-state";

export const metadata: Metadata = { title: "Bookings" };

// Built in the next phase, once the SQL in supabase/proposed has been applied.
export default function AdminBookingsPage() {
  return (
    <>
      <AdminPageHeader title="Bookings" description="Test drives and appointments." />
      <EmptyState
        icon={DatabaseZap}
        title="Waiting for database setup"
        description="The bookings table will appear here once the SQL files in supabase/proposed have been applied."
      />
    </>
  );
}
