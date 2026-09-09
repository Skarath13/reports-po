import { useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns2,
  List,
  Search,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export default function ScheduleBrowser({
  classic = false,
  appointments,
  hideNames,
  view,
  onViewChange,
  sorting,
  onSortingChange,
  technician: savedTechnician,
  onTechnicianChange,
  renderRow,
  renderGroups,
}) {
  const [query, setQuery] = useState('');
  const technicians = useMemo(
    () => [
      ...new Set(
        appointments.map((appointment) => appointment.technicianName),
      ),
    ],
    [appointments],
  );
  const technician = technicians.includes(savedTechnician)
    ? savedTechnician
    : 'all';
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return appointments.filter(
      (appointment) =>
        (technician === 'all' || appointment.technicianName === technician) &&
        [
          appointment.serviceName,
          appointment.technicianName,
          !hideNames && appointment.customerName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(search),
    );
  }, [appointments, hideNames, query, technician]);
  const columns = useMemo(
    () => [
      { accessorKey: 'appointmentTime', header: 'Time' },
      ...(!hideNames
        ? [{ accessorKey: 'customerName', header: 'Client' }]
        : []),
      { accessorKey: 'serviceName', header: 'Service' },
      { accessorKey: 'technicianName', header: 'Technician' },
      { id: 'details', header: 'Last visit / price', enableSorting: false },
      { id: 'actions', header: 'Actions', enableSorting: false },
    ],
    [hideNames],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting:
        hideNames && sorting[0]?.id === 'customerName'
          ? [{ id: 'appointmentTime', desc: false }]
          : sorting,
    },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  // Keep New's draft search and saved filters mounted, but show the complete
  // original technician columns in Old. Neither view changes the signed snapshot.
  if (classic) return <div className="classic-schedule">{renderGroups(appointments)}</div>;

  return (
    <div className="schedule-browser">
      <div className="schedule-toolbar">
        <div className="schedule-search">
          <Search size={15} />
          <Input
            aria-label="Search schedule"
            placeholder={
              hideNames
                ? 'Search service or technician…'
                : 'Search clients, services…'
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <select
          aria-label="Filter by technician"
          value={technician}
          onChange={(event) => onTechnicianChange(event.target.value)}
        >
          <option value="all">All technicians</option>
          {technicians.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="schedule-view-toggle" aria-label="Schedule layout">
          <Button
            variant={view === 'grouped' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={view === 'grouped'}
            onClick={() => onViewChange('grouped')}
          >
            <Columns2 size={15} />
            By technician
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
          >
            <List size={15} />
            List
          </Button>
        </div>
      </div>
      {filtered.length > 0 ? (
        view === 'grouped' ? (
          renderGroups(filtered)
        ) : (
          <Table
            className={`schedule-table ${hideNames ? 'names-hidden' : ''}`}
            aria-label="Appointments"
          >
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        scope="col"
                        key={header.id}
                        aria-sort={
                          header.column.getCanSort()
                            ? sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : 'none'
                            : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.column.columnDef.header}
                            {sorted === 'asc' ? (
                              <ArrowUp size={12} />
                            ) : sorted === 'desc' ? (
                              <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} />
                            )}
                          </button>
                        ) : (
                          <span
                            className={
                              header.id === 'actions' ? 'sr-only' : ''
                            }
                          >
                            {header.column.columnDef.header}
                          </span>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => renderRow(row.original))}
            </TableBody>
          </Table>
        )
      ) : (
        <div className="schedule-empty">
          <Search size={22} />
          <strong>No matching appointments</strong>
          <p>Try a different search or technician.</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              onTechnicianChange('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <div className="schedule-caption">
        <span>
          {filtered.length} of {appointments.length} appointments
          {query || technician !== 'all' ? ' · filtered view' : ''}
        </span>
        <span>
          {hideNames ? 'Names hidden in schedule' : 'Client names visible'} ·
          Prices are booking labels
        </span>
      </div>
    </div>
  );
}
