import { CarCardSkeleton } from "@/components/site/car-card";
import { PageHeader } from "@/components/site/section";
import { Skeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Find your next vehicle"
        description="Every car on this page is on our Texas lots or on its way. Prices are current and updated as stock changes."
      />
      <div className="container-page grid grid-cols-1 gap-6 py-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8 lg:py-14" aria-busy="true">
        <span className="sr-only" role="status">
          Loading inventory
        </span>
        <div className="hidden space-y-6 rounded-2xl border p-6 lg:block">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-52" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CarCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
