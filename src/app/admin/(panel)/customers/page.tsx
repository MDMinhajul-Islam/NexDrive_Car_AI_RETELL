import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { CustomersTable } from "@/components/admin/customers/customers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/site/empty-state";
import type { RawParams } from "@/lib/admin/table-params";
import { listCustomers, parseCustomerFilters } from "@/lib/data/admin/customers";

export const metadata: Metadata = { title: "Customers" };

type Props = { searchParams: Promise<RawParams> };

export default async function AdminCustomersPage({ searchParams }: Props) {
  const filters = parseCustomerFilters(await searchParams);
  const result = await listCustomers(filters);
  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Everyone who has called, booked online or visited. New customers are created by the booking flows."
      />
      {result.error ? (
        <EmptyState icon={TriangleAlert} title="Customers could not be loaded" description={result.error} />
      ) : (
        <CustomersTable rows={result.rows} total={result.total} filters={filters} />
      )}
    </>
  );
}
