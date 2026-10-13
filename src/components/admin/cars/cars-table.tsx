"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BadgeDollarSign, ExternalLink, MoreHorizontal, Pencil, Plus, Star, StarOff, X } from "lucide-react";
import { setVehicleFeatured, setVehicleStatus } from "@/app/actions/admin/cars";
import { VehicleFormDialog } from "@/components/admin/cars/vehicle-form-dialog";
import { DataTable, type AdminColumn } from "@/components/admin/data-table";
import { FilterSelect } from "@/components/admin/filter-select";
import { SearchInput } from "@/components/admin/search-input";
import { useUrlState } from "@/components/admin/use-url-state";
import { VehicleStatusBadge } from "@/components/site/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BODY_TYPES, VEHICLE_CONDITIONS, VEHICLE_STATUSES } from "@/lib/constants";
import type { CarFilters, CarRow, FeatureOption } from "@/lib/data/admin/cars";
import { formatCurrency, formatDateTime, formatMileage } from "@/lib/format";

type Confirm = { ids: string[]; label: string } | null;

export function CarsTable({
  rows,
  total,
  filters,
  features,
}: {
  rows: CarRow[];
  total: number;
  filters: CarFilters;
  features: FeatureOption[];
}) {
  const { setParams } = useUrlState();
  const [, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CarRow | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [confirmSold, setConfirmSold] = useState<Confirm>(null);
  const [bulkStatus, setBulkStatus] = useState<string>("Available");

  // After creating a vehicle, reopen it in edit mode once the refreshed rows include it,
  // so photos can be added straight away.
  useEffect(() => {
    if (!pendingEditId) return;
    const created = rows.find((r) => r.vehicle_id === pendingEditId);
    if (created) {
      setEditing(created);
      setFormOpen(true);
      setPendingEditId(null);
    }
  }, [rows, pendingEditId]);

  const run = (action: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        after?.();
      } else {
        toast.error(result.message);
      }
    });
  };

  const columns = useMemo<AdminColumn<CarRow>[]>(
    () => [
      {
        id: "vehicle",
        label: "Vehicle",
        sortKey: "make",
        enableHiding: false,
        cell: ({ row }) => {
          const v = row.original;
          return (
            <div className="min-w-52">
              <button
                type="button"
                onClick={() => {
                  setEditing(v);
                  setFormOpen(true);
                }}
                className="flex items-center gap-1.5 text-left font-medium underline-offset-4 hover:underline"
              >
                {v.year} {v.make} {v.model}
                {v.is_featured ? (
                  <Star className="size-3.5 fill-brand text-brand" aria-label="Featured" />
                ) : null}
              </button>
              <p className="text-xs text-muted-foreground">
                {v.trim} · {v.body_type} · {v.exterior_color}
              </p>
            </div>
          );
        },
      },
      {
        id: "vehicle_id",
        label: "ID and stock",
        sortKey: "vehicle_id",
        cell: ({ row }) => (
          <div className="whitespace-nowrap font-mono text-xs">
            <p>{row.original.vehicle_id}</p>
            <p className="text-muted-foreground">{row.original.stock_number}</p>
          </div>
        ),
      },
      {
        id: "vehicle_status",
        label: "Status",
        sortKey: "vehicle_status",
        cell: ({ row }) => <VehicleStatusBadge status={row.original.vehicle_status} className="whitespace-nowrap" />,
      },
      {
        id: "condition",
        label: "Condition",
        header: "Condition",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.condition}</span>,
      },
      {
        id: "sale_price",
        label: "Price",
        sortKey: "sale_price",
        className: "text-right",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-right tabular-nums">
            <p className="font-medium">{formatCurrency(row.original.sale_price)}</p>
            <p className="text-xs text-muted-foreground">MSRP {formatCurrency(row.original.msrp)}</p>
          </div>
        ),
      },
      {
        id: "mileage",
        label: "Mileage",
        sortKey: "mileage",
        className: "text-right",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">{formatMileage(row.original.mileage)}</span>
        ),
      },
      {
        id: "year",
        label: "Year",
        sortKey: "year",
        cell: ({ row }) => <span className="tabular-nums">{row.original.year}</span>,
      },
      {
        id: "test_drive",
        label: "Test drive",
        header: "Test drive",
        cell: ({ row }) => (row.original.test_drive_available ? "Yes" : "No"),
      },
      {
        id: "vin",
        label: "VIN",
        header: "VIN",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.vin}</span>,
      },
      {
        id: "location",
        label: "Location",
        header: "Location",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.dealership_location}</span>,
      },
      {
        id: "updated_at",
        label: "Updated",
        sortKey: "updated_at",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.original.updated_at)}</span>
        ),
      },
      {
        id: "actions",
        label: "Actions",
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        className: "w-12 text-right",
        cell: ({ row }) => {
          const v = row.original;
          const name = `${v.year} ${v.make} ${v.model}`;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditing(v);
                    setFormOpen(true);
                  }}
                >
                  <Pencil aria-hidden="true" /> Edit and photos
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/cars/${v.vehicle_id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" /> View on website
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={v.vehicle_status === "Sold" && !v.is_featured}
                  onSelect={() => run(() => setVehicleFeatured([v.vehicle_id], !v.is_featured))}
                >
                  {v.is_featured ? <StarOff aria-hidden="true" /> : <Star aria-hidden="true" />}
                  {v.is_featured ? "Remove from featured" : "Mark as featured"}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={v.vehicle_status}
                      onValueChange={(status) => {
                        if (status === v.vehicle_status) return;
                        if (status === "Sold") setConfirmSold({ ids: [v.vehicle_id], label: name });
                        else run(() => setVehicleStatus([v.vehicle_id], status));
                      }}
                    >
                      {VEHICLE_STATUSES.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {s}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={v.vehicle_status === "Sold"}
                  onSelect={() => setConfirmSold({ ids: [v.vehicle_id], label: name })}
                >
                  <BadgeDollarSign aria-hidden="true" /> Mark as sold
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const hasFilters = Boolean(filters.q || filters.status || filters.condition || filters.body || filters.featured);

  return (
    <>
      <DataTable
        caption="Inventory"
        columns={columns}
        data={rows}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        sort={filters.sort === "make" ? "make" : filters.sort}
        dir={filters.dir}
        getRowId={(row) => row.vehicle_id}
        selectable
        initialHidden={["year", "test_drive", "vin", "location", "updated_at"]}
        emptyMessage={hasFilters ? "No vehicles match these filters." : "No vehicles yet."}
        toolbar={
          <>
            <SearchInput label="Search inventory" placeholder="Make, model, stock number or VIN" />
            <FilterSelect param="status" label="Filter by status" allLabel="All statuses" options={VEHICLE_STATUSES} />
            <FilterSelect param="condition" label="Filter by condition" allLabel="All conditions" options={VEHICLE_CONDITIONS} className="sm:w-48" />
            <FilterSelect param="body" label="Filter by body type" allLabel="All body types" options={BODY_TYPES} />
            <FilterSelect
              param="featured"
              label="Filter by featured"
              allLabel="Featured and not"
              options={[{ value: "yes", label: "Featured only" }]}
            />
            {hasFilters ? (
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => setParams({ q: null, status: null, condition: null, body: null, featured: null })}
              >
                <X aria-hidden="true" /> Clear
              </Button>
            ) : null}
            <Button
              className="h-9 max-sm:w-full lg:ml-auto"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus aria-hidden="true" /> Add vehicle
            </Button>
          </>
        }
        bulkActions={(ids, clear) => (
          <>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-8 w-40" aria-label="Status to apply">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_STATUSES.filter((s) => s !== "Sold").map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => run(() => setVehicleStatus(ids, bulkStatus), clear)}>
              Apply status
            </Button>
            <Button size="sm" variant="outline" onClick={() => run(() => setVehicleFeatured(ids, true), clear)}>
              <Star aria-hidden="true" /> Feature
            </Button>
            <Button size="sm" variant="outline" onClick={() => run(() => setVehicleFeatured(ids, false), clear)}>
              <StarOff aria-hidden="true" /> Unfeature
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmSold({ ids, label: `${ids.length} vehicle${ids.length === 1 ? "" : "s"}` })}
            >
              <BadgeDollarSign aria-hidden="true" /> Mark sold
            </Button>
          </>
        )}
      />

      <VehicleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        car={editing}
        features={features}
        onCreated={(id) => {
          setFormOpen(false);
          // Jump to the new vehicle so it is in the current page of rows, then reopen it.
          setPendingEditId(id);
          setParams({ q: id, status: null, condition: null, body: null, featured: null });
        }}
      />

      {/* Vehicles are never deleted. Sold vehicles leave the website but stay in reports. */}
      <AlertDialog open={confirmSold !== null} onOpenChange={(open) => !open && setConfirmSold(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {confirmSold?.label} as sold?</AlertDialogTitle>
            <AlertDialogDescription>
              Sold vehicles are removed from the public website, taken off the featured list and closed to test
              drives. The record is kept, and the status can be changed back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmSold) run(() => setVehicleStatus(confirmSold.ids, "Sold"));
                setConfirmSold(null);
              }}
            >
              Mark as sold
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
