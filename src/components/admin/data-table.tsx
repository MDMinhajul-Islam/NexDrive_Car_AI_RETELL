"use client";

import {
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
  type ColumnVisibilityState,
  type RowData,
} from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlState } from "@/components/admin/use-url-state";
import { PAGE_SIZES } from "@/lib/admin/table-params";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Features used by every admin table. Sorting and pagination are registered so the
 * table owns their state shape, but both run in MANUAL mode: Postgres sorts and pages,
 * the browser only ever holds one page of rows.
 */
export const adminTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  rowPaginationFeature,
});

export type AdminColumn<T extends RowData> = ColumnDef<typeof adminTableFeatures, T> & {
  /** Label used in the column picker and for accessibility. */
  label: string;
  /** URL sort key. Omit for columns the server cannot sort by. */
  sortKey?: string;
  className?: string;
};

export function DataTable<T extends RowData>({
  columns,
  data,
  total,
  page,
  pageSize,
  sort,
  dir,
  getRowId,
  selectable = false,
  initialHidden,
  toolbar,
  bulkActions,
  emptyMessage = "No results.",
  caption,
}: {
  columns: AdminColumn<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
  getRowId: (row: T) => string;
  selectable?: boolean;
  initialHidden?: string[];
  toolbar?: ReactNode;
  /** Rendered when rows are selected. Call `clear()` after a bulk action succeeds. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  emptyMessage?: string;
  caption: string;
}) {
  const { setParams, pending } = useUrlState();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    Object.fromEntries((initialHidden ?? []).map((id) => [id, false])),
  );

  const sorting = useMemo(() => [{ id: sort, desc: dir === "desc" }], [sort, dir]);
  const pagination = useMemo(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);

  const table = useTable({
    features: adminTableFeatures,
    columns,
    data,
    getRowId,
    rowCount: total,
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: selectable,
    state: { sorting, pagination, rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const columnMeta = (id: string) => columns.find((c) => c.id === id);
  const visibleColumnCount = table.getVisibleLeafColumns().length + (selectable ? 1 : 0);

  const toggleSort = (key: string) => {
    if (sort !== key) setParams({ sort: key, dir: "asc" });
    else setParams({ sort: key, dir: dir === "asc" ? "desc" : "asc" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-3">{toolbar}</div>
        <div className="flex items-center gap-2">
          {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" /> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9">
                <Columns3 aria-hidden="true" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnMeta(column.id)?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectable && selectedIds.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3"
        >
          <p className="text-sm font-medium">{selectedIds.length} selected</p>
          {bulkActions?.(selectedIds, () => setRowSelection({}))}
          <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className={cn("overflow-hidden rounded-xl border bg-card transition-opacity", pending && "opacity-60")}>
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/50 hover:bg-muted/50">
                {selectable ? (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all rows on this page"
                      checked={
                        table.getIsAllPageRowsSelected()
                          ? true
                          : table.getIsSomePageRowsSelected()
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
                    />
                  </TableHead>
                ) : null}
                {group.headers
                  .filter((header) => header.column.getIsVisible())
                  .map((header) => {
                    const meta = columnMeta(header.column.id);
                    const sortKey = meta?.sortKey;
                    const active = sortKey !== undefined && sortKey === sort;
                    return (
                      <TableHead
                        key={header.id}
                        className={meta?.className}
                        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        {sortKey ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(sortKey)}
                            className="-ml-2 inline-flex h-8 items-center gap-1 rounded-md px-2 font-medium hover:bg-muted"
                          >
                            {meta?.label}
                            {active ? (
                              dir === "asc" ? (
                                <ArrowUp className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="size-3.5" aria-hidden="true" />
                              )
                            ) : (
                              <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    );
                  })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="h-32 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {selectable ? (
                    <TableCell className="w-10">
                      <Checkbox
                        aria-label={`Select row ${row.id}`}
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
                      />
                    </TableCell>
                  ) : null}
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={columnMeta(cell.column.id)?.className}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total === 0 ? "0 results" : `${formatNumber(from)} to ${formatNumber(to)} of ${formatNumber(total)}`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span id="rows-per-page" className="text-sm text-muted-foreground">
              Rows
            </span>
            <Select value={String(pageSize)} onValueChange={(value) => setParams({ pageSize: value })}>
              <SelectTrigger className="h-9 w-20" aria-labelledby="rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Page {formatNumber(page)} of {formatNumber(pageCount)}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setParams({ page: page - 1 })}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() => setParams({ page: page + 1 })}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
