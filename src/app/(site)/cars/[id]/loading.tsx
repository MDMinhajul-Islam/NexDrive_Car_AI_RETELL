import { Skeleton } from "@/components/ui/skeleton";

export default function VehicleLoading() {
  return (
    <div className="container-page py-8 lg:py-12" aria-busy="true">
      <span className="sr-only" role="status">
        Loading vehicle
      </span>
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-8">
          <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[36rem] w-full rounded-2xl" />
      </div>
    </div>
  );
}
