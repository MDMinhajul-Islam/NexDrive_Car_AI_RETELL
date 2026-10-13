import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { BookingsTable } from "@/components/admin/bookings/bookings-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/site/empty-state";
import type { RawParams } from "@/lib/admin/table-params";
import { listBookings, listSalespeople, parseBookingFilters } from "@/lib/data/admin/bookings";
import { todayInDealershipTz } from "@/lib/format";

export const metadata: Metadata = { title: "Bookings" };

type Props = { searchParams: Promise<RawParams> };

export default async function AdminBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = parseBookingFilters(sp);
  const [result, salespeople] = await Promise.all([listBookings(filters), listSalespeople()]);

  // The export uses the same filters and sort, without paging.
  const exportParams = new URLSearchParams();
  for (const key of ["q", "status", "type", "from", "to", "sort", "dir"] as const) {
    const value = String(filters[key] ?? "");
    if (value) exportParams.set(key, value);
  }

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        description="Test drives and appointments from the website, the voice agent and staff. Times are US Central."
      />
      {result.error ? (
        <EmptyState icon={TriangleAlert} title="Bookings could not be loaded" description={result.error} />
      ) : (
        <BookingsTable
          rows={result.rows}
          total={result.total}
          filters={filters}
          salespeople={salespeople}
          today={todayInDealershipTz()}
          exportHref={`/admin/bookings/export?${exportParams.toString()}`}
        />
      )}
    </>
  );
}
