import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { CarsTable } from "@/components/admin/cars/cars-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/site/empty-state";
import type { RawParams } from "@/lib/admin/table-params";
import { listCars, listFeatures, parseCarFilters } from "@/lib/data/admin/cars";

export const metadata: Metadata = { title: "Cars" };

type Props = { searchParams: Promise<RawParams> };

export default async function AdminCarsPage({ searchParams }: Props) {
  const filters = parseCarFilters(await searchParams);
  const [result, features] = await Promise.all([listCars(filters), listFeatures()]);

  return (
    <>
      <AdminPageHeader
        title="Cars"
        description="Inventory, pricing, photos and featured vehicles. Vehicles are marked Sold, never deleted."
      />
      {result.error ? (
        <EmptyState icon={TriangleAlert} title="Inventory could not be loaded" description={result.error} />
      ) : (
        <CarsTable rows={result.rows} total={result.total} filters={filters} features={features} />
      )}
    </>
  );
}
