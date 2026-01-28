import { useState, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  SlidersHorizontal,
  Plus,
  X,
} from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterableColumn {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface ExportData<TData> {
  rows: TData[];
  visibleColumns: { id: string; header: string }[];
}

interface AirtableDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  filterableColumns?: FilterableColumn[];
  initialFilters?: Record<string, string>;
  onAddColumn?: () => void;
  onExport?: (exportData: ExportData<TData>) => void;
  loading?: boolean;
  hiddenColumns?: string[];
  onHiddenColumnsChange?: (columns: string[]) => void;
  onRowClick?: (row: TData) => void;
}

export function AirtableDataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Buscar...",
  filterableColumns = [],
  initialFilters = {},
  onAddColumn,
  onExport,
  loading = false,
  hiddenColumns = [],
  onHiddenColumnsChange,
  onRowClick,
}: AirtableDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(initialFilters);
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);

  // Initialize column visibility from hiddenColumns prop
  useEffect(() => {
    const visibility: VisibilityState = {};
    hiddenColumns.forEach((col) => {
      visibility[col] = false;
    });
    setColumnVisibility(visibility);
  }, [hiddenColumns]);

  // Sync visibility changes back to parent
  useEffect(() => {
    if (onHiddenColumnsChange) {
      const hidden = Object.entries(columnVisibility)
        .filter(([_, visible]) => !visible)
        .map(([key]) => key);
      onHiddenColumnsChange(hidden);
    }
  }, [columnVisibility, onHiddenColumnsChange]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      columnVisibility,
    },
  });

  // Apply initial filters to table columns once table is ready
  useEffect(() => {
    if (!initialFiltersApplied && Object.keys(initialFilters).length > 0 && data.length > 0) {
      Object.entries(initialFilters).forEach(([key, value]) => {
        table.getColumn(key)?.setFilterValue(value);
      });
      setInitialFiltersApplied(true);
    }
  }, [initialFilters, initialFiltersApplied, data.length, table]);

  const handleFilterChange = (columnKey: string, value: string) => {
    setActiveFilters((prev) => {
      const updated = { ...prev };
      if (value === "all") {
        delete updated[columnKey];
        table.getColumn(columnKey)?.setFilterValue(undefined);
      } else {
        updated[columnKey] = value;
        table.getColumn(columnKey)?.setFilterValue(value);
      }
      return updated;
    });
  };

  const clearFilter = (columnKey: string) => {
    setActiveFilters((prev) => {
      const updated = { ...prev };
      delete updated[columnKey];
      return updated;
    });
    table.getColumn(columnKey)?.setFilterValue(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-9"
            />
          </div>
          
          {/* Action buttons - right side */}
          <div className="flex items-center gap-2">
            {/* Column Visibility Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Columnas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    const header = column.columnDef.header;
                    const label =
                      typeof header === "string"
                        ? header
                        : column.id === "actions"
                        ? "Acciones"
                        : column.id;
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add Column Button */}
            {onAddColumn && (
              <Button variant="outline" size="sm" onClick={onAddColumn}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Campo</span>
              </Button>
            )}

            {/* Export Button */}
            {onExport && (
              <Button variant="outline" size="sm" onClick={() => {
                const visibleColumns = table.getVisibleLeafColumns()
                  .filter(col => col.id !== "actions")
                  .map(col => ({
                    id: col.id,
                    header: typeof col.columnDef.header === "string" 
                      ? col.columnDef.header 
                      : col.id,
                  }));
                const rows = table.getFilteredRowModel().rows.map(row => row.original);
                onExport({ rows, visibleColumns });
              }}>
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        {filterableColumns.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Column Filters */}
            {filterableColumns.map((filter) => (
              <Select
                key={filter.key}
                value={activeFilters[filter.key] || "all"}
                onValueChange={(value) => handleFilterChange(filter.key, value)}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}

            {/* Active Filter Tags */}
            {Object.entries(activeFilters).map(([key, value]) => {
              const filterConfig = filterableColumns.find((f) => f.key === key);
              const optionLabel = filterConfig?.options.find(
                (o) => o.value === value
              )?.label;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs sm:text-sm"
                >
                  <span className="truncate max-w-[120px] sm:max-w-none">
                    {filterConfig?.label}: {optionLabel}
                  </span>
                  <button
                    onClick={() => clearFilter(key)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table with horizontal scroll */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="group whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Cargando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => onRowClick?.(row.original)}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No se encontraron resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {table.getFilteredSelectedRowModel().rows.length} de{" "}
            {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s).
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              Filas por página
            </span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[25, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
