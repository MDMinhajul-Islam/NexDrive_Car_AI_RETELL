"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, Eye, MoreHorizontal, Pencil, X } from "lucide-react";
import { CustomerFormDialog } from "@/components/admin/customers/customer-form-dialog";
import { DataTable, type AdminColumn } from "@/components/admin/data-table";
import { FilterSelect } from "@/components/admin/filter-select";
import { SearchInput } from "@/components/admin/search-input";
import { useUrlState } from "@/components/admin/use-url-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BUYER_PROFILES } from "@/lib/constants";
import type { CustomerFilters, CustomerRow } from "@/lib/data/admin/customers";
import { formatCurrency, formatDateTime } from "@/lib/format";

const yesNo = (v: boolean | null) => (v == null ? "Not set" : v ? "Yes" : "No");
const budget = (c: CustomerRow) =>
  c.budget_min != null && c.budget_max != null
    ? `${formatCurrency(c.budget_min)} to ${formatCurrency(c.budget_max)}`
    : "Not set";

export function CustomersTable({
  rows,
  total,
  filters,
}: {
  rows: CustomerRow[];
  total: number;
  filters: CustomerFilters;
}) {
  const { setParams } = useUrlState();
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [viewing, setViewing] = useState<CustomerRow | null>(null);

  const columns = useMemo<AdminColumn<CustomerRow>[]>(
    () => [
      {
        id: "last_name",
        label: "Customer",
        sortKey: "last_name",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="min-w-44">
            <button
              type="button"
              onClick={() => setViewing(row.original)}
              className="text-left font-medium underline-offset-4 hover:underline"
            >
              {row.original.first_name} {row.original.last_name}
            </button>
            <p className="font-mono text-xs text-muted-foreground">{row.original.customer_id}</p>
          </div>
        ),
      },
      {
        id: "contact",
        label: "Contact",
        header: "Contact",
        cell: ({ row }) => (
          <div className="min-w-48">
            <p className="whitespace-nowrap">{row.original.synthetic_phone}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.synthetic_email ?? "No email"}</p>
          </div>
        ),
      },
      {
        id: "city",
        label: "City",
        header: "City",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.city ?? "Not set"}</span>,
      },
      {
        id: "budget_max",
        label: "Budget",
        sortKey: "budget_max",
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{budget(row.original)}</span>,
      },
      {
        id: "preference",
        label: "Looking for",
        header: "Looking for",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {[row.original.preferred_brand, row.original.preferred_vehicle_type].filter(Boolean).join(" ") || "Not set"}
          </span>
        ),
      },
      {
        id: "buyer_profile",
        label: "Profile",
        header: "Profile",
        cell: ({ row }) => row.original.buyer_profile ?? "Not set",
      },
      {
        id: "timeline",
        label: "Timeline",
        header: "Timeline",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.purchase_timeline ?? "Not set"}</span>,
      },
      {
        id: "lead_source",
        label: "Source",
        header: "Source",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.lead_source ?? "Not set"}</span>,
      },
      {
        id: "created_at",
        label: "Created",
        sortKey: "created_at",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
        ),
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
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${c.first_name} ${c.last_name}`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setViewing(c)}>
                  <Eye aria-hidden="true" /> View details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditing(c)}>
                  <Pencil aria-hidden="true" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/bookings?q=${c.customer_id}`}>
                    <CalendarCheck aria-hidden="true" /> View bookings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const hasFilters = Boolean(filters.q || filters.profile);

  return (
    <>
      <DataTable
        caption="Customers"
        columns={columns}
        data={rows}
        total={total}
        page={filters.page}
        pageSize={filters.pageSize}
        sort={filters.sort}
        dir={filters.dir}
        getRowId={(row) => row.customer_id}
        initialHidden={["timeline", "lead_source", "created_at"]}
        emptyMessage={hasFilters ? "No customers match these filters." : "No customers yet."}
        toolbar={
          <>
            <SearchInput label="Search customers" placeholder="Name, phone, email, city or CUST id" />
            <FilterSelect param="profile" label="Filter by buyer profile" allLabel="All profiles" options={BUYER_PROFILES} />
            {hasFilters ? (
              <Button variant="ghost" className="h-9" onClick={() => setParams({ q: null, profile: null })}>
                <X aria-hidden="true" /> Clear
              </Button>
            ) : null}
          </>
        }
      />

      <CustomerFormDialog customer={editing} onOpenChange={(open) => !open && setEditing(null)} />

      <Sheet open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {viewing ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {viewing.first_name} {viewing.last_name}
                </SheetTitle>
                <SheetDescription className="font-mono">{viewing.customer_id}</SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <dl className="space-y-3 text-sm">
                  {(
                    [
                      ["Phone", viewing.synthetic_phone],
                      ["Email", viewing.synthetic_email ?? "Not set"],
                      ["City", [viewing.city, viewing.state].filter(Boolean).join(", ") || "Not set"],
                      ["Budget", budget(viewing)],
                      ["Down payment", formatCurrency(Number(viewing.estimated_down_payment ?? 0))],
                      ["Financing needed", yesNo(viewing.financing_needed)],
                      ["Trade-in", yesNo(viewing.trade_in)],
                      ["Family size", viewing.family_size != null ? String(viewing.family_size) : "Not set"],
                      ["Preferred brand", viewing.preferred_brand ?? "Not set"],
                      ["Preferred type", viewing.preferred_vehicle_type ?? "Not set"],
                      ["Timeline", viewing.purchase_timeline ?? "Not set"],
                      ["Buyer profile", viewing.buyer_profile ?? "Not set"],
                      ["Source", viewing.lead_source ?? "Not set"],
                      ["Created", formatDateTime(viewing.created_at)],
                      ["Updated", formatDateTime(viewing.updated_at)],
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
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{viewing.notes || "No notes."}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="h-9 flex-1"
                    onClick={() => {
                      const row = viewing;
                      setViewing(null);
                      setEditing(row);
                    }}
                  >
                    <Pencil aria-hidden="true" /> Edit
                  </Button>
                  <Button asChild variant="outline" className="h-9 flex-1">
                    <Link href={`/admin/bookings?q=${viewing.customer_id}`}>
                      <CalendarCheck aria-hidden="true" /> Bookings
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
