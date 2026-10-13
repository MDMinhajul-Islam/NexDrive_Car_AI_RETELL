"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Download, Eye, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
import { setBookingStatus } from "@/app/actions/admin/bookings";
import { BookingFormDialog } from "@/components/admin/bookings/booking-form-dialog";
import { DataTable, type AdminColumn } from "@/components/admin/data-table";
import { FilterSelect } from "@/components/admin/filter-select";
import { SearchInput } from "@/components/admin/search-input";
import { AppointmentStatusBadge } from "@/components/admin/status-badges";
import { useUrlState } from "@/components/admin/use-url-state";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "@/lib/constants";
import type { BookingFilters, BookingRow, SalespersonOption } from "@/lib/data/admin/bookings";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";

type Confirm = { ids: string[]; label: string } | null;

export function BookingsTable({
  rows,
  total,
  filters,
  salespeople,
  today,
  exportHref,
}: {
  rows: BookingRow[];
  total: number;
  filters: BookingFilters;
  salespeople: SalespersonOption[];
  today: string;
  exportHref: string;
}) {
  const { setParams, get } = useUrlState();
  const [, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookingRow | null>(null);
  const [viewing, setViewing] = useState<BookingRow | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Confirm>(null);
  const [bulkStatus, setBulkStatus] = useState<string>("Confirmed");

  const changeStatus = (ids: string[], status: string, after?: () => void) => {
    startTransition(async () => {
      const result = await setBookingStatus(ids, status);
      if (result.ok) {
        toast.success(result.message);
        after?.();
      } else {
        toast.error(result.message);
      }
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: BookingRow) => {
    setEditing(row);
    setFormOpen(true);
  };

  const columns = useMemo<AdminColumn<BookingRow>[]>(
    () => [
      {
        id: "appointment_id",
        label: "Booking",
        sortKey: "appointment_id",
        accessorKey: "appointment_id",
        enableHiding: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setViewing(row.original)}
            className="font-mono text-sm font-medium underline-offset-4 hover:underline"
          >
            {row.original.appointment_id}
          </button>
        ),
      },
      {
        id: "customer",
        label: "Customer",
        header: "Customer",
        cell: ({ row }) => {
          const c = row.original.customer;
          return c ? (
            <div className="min-w-40">
              <p className="font-medium">
                {c.first_name} {c.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">{row.original.customer_id}</span>
          );
        },
      },
      {
        id: "vehicle",
        label: "Vehicle",
        header: "Vehicle",
        cell: ({ row }) => {
          const v = row.original.vehicle;
          return v ? (
            <div className="min-w-44">
              <Link href={`/cars/${row.original.vehicle_id}`} target="_blank" className="font-medium hover:underline">
                {v.name}
              </Link>
              <p className="text-xs text-muted-foreground">{v.stock_number}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">{row.original.vehicle_id}</span>
          );
        },
      },
      {
        id: "appointment_date",
        label: "Date and time",
        sortKey: "appointment_date",
        accessorKey: "appointment_date",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p>{formatDate(row.original.appointment_date)}</p>
            <p className="text-xs text-muted-foreground">{formatTime(row.original.appointment_time)}</p>
          </div>
        ),
      },
      {
        id: "status",
        label: "Status",
        sortKey: "status",
        accessorKey: "status",
        cell: ({ row }) => <AppointmentStatusBadge status={row.original.status} />,
      },
      {
        id: "type",
        label: "Type",
        header: "Type",
        accessorKey: "appointment_type",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.appointment_type}</span>,
      },
      {
        id: "salesperson",
        label: "Salesperson",
        header: "Salesperson",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.salesperson?.name ?? row.original.salesperson_id}</span>
        ),
      },
      {
        id: "created_by",
        label: "Source",
        header: "Source",
        accessorKey: "created_by",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.created_by}</span>,
      },
      {
        id: "created_at",
        label: "Booked on",
        sortKey: "created_at",
        accessorKey: "created_at",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
        ),
      },
      {
        id: "actions",
        label: "Actions",
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        className: "w-12 text-right",
        cell: ({ row }) => {
          const b = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${b.appointment_id}`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setViewing(b)}>
                  <Eye aria-hidden="true" /> View details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openEdit(b)}>
                  <Pencil aria-hidden="true" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={b.status}
                      onValueChange={(status) => status !== b.status && changeStatus([b.appointment_id], status)}
                    >
                      {APPOINTMENT_STATUSES.map((s) => (
                        <DropdownMenuRadioItem key={s} value={s}>
                          {s}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={b.status === "Cancelled"}
                  onSelect={() => setConfirmCancel({ ids: [b.appointment_id], label: b.appointment_id })}
                >
                  <Ban aria-hidden="true" /> Cancel booking
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const hasFilters = Boolean(filters.q || filters.status || filters.type || filters.from || filters.to);

  return (
    <>
      <DataTable
        caption="Bookings"
        columns={columns}
        data={rows}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        sort={filters.sort}
        dir={filters.dir}
        getRowId={(row) => row.appointment_id}
        selectable
        initialHidden={["created_by", "created_at"]}
        emptyMessage={hasFilters ? "No bookings match these filters." : "No bookings yet."}
        toolbar={
          <>
            <SearchInput label="Search bookings" placeholder="Customer, phone, email or APT id" />
            <FilterSelect param="status" label="Filter by status" allLabel="All statuses" options={APPOINTMENT_STATUSES} />
            <FilterSelect param="type" label="Filter by type" allLabel="All types" options={APPOINTMENT_TYPES} className="w-48" />
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="bk-from" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="bk-from"
                  type="date"
                  value={get("from")}
                  max={get("to") || undefined}
                  onChange={(e) => setParams({ from: e.target.value })}
                  className="h-9 w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bk-to" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="bk-to"
                  type="date"
                  value={get("to")}
                  min={get("from") || undefined}
                  onChange={(e) => setParams({ to: e.target.value })}
                  className="h-9 w-40"
                />
              </div>
            </div>
            {hasFilters ? (
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => setParams({ q: null, status: null, type: null, from: null, to: null })}
              >
                <X aria-hidden="true" /> Clear
              </Button>
            ) : null}
            <div className="flex gap-2 lg:ml-auto">
              <Button asChild variant="outline" className="h-9">
                {/* Server-generated file with the same filters; not limited to the current page. */}
                <a href={exportHref} download>
                  <Download aria-hidden="true" /> Export CSV
                </a>
              </Button>
              <Button className="h-9" onClick={openCreate}>
                <Plus aria-hidden="true" /> New booking
              </Button>
            </div>
          </>
        }
        bulkActions={(ids, clear) => (
          <>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-8 w-40" aria-label="Status to apply">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_STATUSES.filter((s) => s !== "Cancelled").map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => changeStatus(ids, bulkStatus, clear)}>
              Apply status
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmCancel({ ids, label: `${ids.length} booking${ids.length === 1 ? "" : "s"}` })}
            >
              <Ban aria-hidden="true" /> Cancel selected
            </Button>
          </>
        )}
      />

      <BookingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        booking={editing}
        salespeople={salespeople}
        today={today}
      />

      {/* Details */}
      <Sheet open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {viewing ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{viewing.appointment_id}</SheetTitle>
                <SheetDescription>
                  {viewing.appointment_type} on {formatDate(viewing.appointment_date)} at{" "}
                  {formatTime(viewing.appointment_time)} (US Central)
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <AppointmentStatusBadge status={viewing.status} />
                <dl className="space-y-4 text-sm">
                  {(
                    [
                      [
                        "Customer",
                        viewing.customer
                          ? `${viewing.customer.first_name} ${viewing.customer.last_name}`
                          : viewing.customer_id,
                      ],
                      ["Phone", viewing.customer?.phone ?? "N/A"],
                      ["Email", viewing.customer?.email ?? "N/A"],
                      ["Vehicle", viewing.vehicle?.name ?? viewing.vehicle_id],
                      ["Stock number", viewing.vehicle?.stock_number ?? "N/A"],
                      ["Salesperson", viewing.salesperson?.name ?? viewing.salesperson_id],
                      ["Source", viewing.created_by],
                      ["Lead", viewing.lead_id],
                      ["Booked on", formatDateTime(viewing.created_at)],
                      ["Last updated", formatDateTime(viewing.updated_at)],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-6 border-b pb-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h3 className="text-sm font-medium">Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                    {viewing.notes || "No notes."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="h-9 flex-1"
                    onClick={() => {
                      const row = viewing;
                      setViewing(null);
                      openEdit(row);
                    }}
                  >
                    <Pencil aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-9 flex-1"
                    disabled={viewing.status === "Cancelled"}
                    onClick={() => {
                      const row = viewing;
                      setViewing(null);
                      setConfirmCancel({ ids: [row.appointment_id], label: row.appointment_id });
                    }}
                  >
                    <Ban aria-hidden="true" /> Cancel booking
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Bookings are never deleted. "Cancel" keeps the record with status Cancelled. */}
      <AlertDialog open={confirmCancel !== null} onOpenChange={(open) => !open && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {confirmCancel?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The status changes to Cancelled and the time slot is released. The record is kept for reporting and
              can be reopened later by changing its status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmCancel) changeStatus(confirmCancel.ids, "Cancelled");
                setConfirmCancel(null);
              }}
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
