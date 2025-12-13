"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react"
import type { Endpoint } from "@/types/endpoint.types"
import { TruncatedCell, TruncatedUrlCell } from "@/components/ui/truncated-cell"

interface CreateColumnsProps {
  formatDate: (dateString: string) => string
}

function DataTableColumnHeader({
  column,
  title,
}: {
  column: { getCanSort: () => boolean; getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void }
  title: string
}) {
  if (!column.getCanSort()) {
    return <div className="-ml-3 font-medium">{title}</div>
  }

  const isSorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-3 h-8 data-[state=open]:bg-accent hover:bg-muted"
    >
      {title}
      {isSorted === "asc" ? (
        <ChevronUp />
      ) : isSorted === "desc" ? (
        <ChevronDown />
      ) : (
        <ChevronsUpDown />
      )}
    </Button>
  )
}

function HttpStatusBadge({ statusCode }: { statusCode: number | null | undefined }) {
  if (statusCode === null || statusCode === undefined) {
    return (
      <Badge variant="outline" className="text-muted-foreground px-2 py-1 font-mono">
        -
      </Badge>
    )
  }

  const getStatusVariant = (code: number): "default" | "secondary" | "destructive" | "outline" => {
    if (code >= 200 && code < 300) {
      return "outline"
    } else if (code >= 300 && code < 400) {
      return "secondary"
    } else if (code >= 400 && code < 500) {
      return "default"
    } else if (code >= 500) {
      return "destructive"
    } else {
      return "secondary"
    }
  }

  const variant = getStatusVariant(statusCode)

  return (
    <Badge variant={variant} className="px-2 py-1 font-mono tabular-nums">
      {statusCode}
    </Badge>
  )
}

export function createEndpointColumns({
  formatDate,
}: CreateColumnsProps): ColumnDef<Endpoint>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "url",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="URL" />
      ),
      size: 300,
      minSize: 200,
      maxSize: 400,
      cell: ({ row }) => (
        <TruncatedUrlCell value={row.getValue("url")} />
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("title")} maxLength="title" />
      ),
    },
    {
      accessorKey: "statusCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("statusCode") as number | null | undefined
        return <HttpStatusBadge statusCode={status} />
      },
    },
    {
      accessorKey: "contentLength",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Content Length" />
      ),
      cell: ({ row }) => {
        const len = row.getValue("contentLength") as number | null | undefined
        if (len === null || len === undefined) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return <span className="font-mono tabular-nums">{new Intl.NumberFormat().format(len)}</span>
      },
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("location")} maxLength="location" />
      ),
    },
    {
      accessorKey: "webserver",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Web Server" />
      ),
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("webserver")} maxLength="webServer" />
      ),
    },
    {
      accessorKey: "contentType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Content Type" />
      ),
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("contentType")} maxLength="contentType" />
      ),
    },
    {
      accessorKey: "tech",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Technologies" />
      ),
      cell: ({ row }) => {
        const tech = (row.getValue("tech") as string[] | null | undefined) || []
        if (!tech.length) return <span className="text-sm text-muted-foreground">-</span>

        const displayTech = tech.slice(0, 2)
        const hasMore = tech.length > 2

        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {displayTech.map((t, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))}
            {hasMore && (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-muted">
                    +{tech.length - 2}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">所有技术栈 ({tech.length})</h4>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {tech.map((technology, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                        >
                          {technology}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "bodyPreview",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Body Preview" />
      ),
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("bodyPreview")} maxLength="bodyPreview" />
      ),
    },
    {
      accessorKey: "vhost",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="VHost" />
      ),
      cell: ({ row }) => {
        const vhost = row.getValue("vhost") as boolean | null | undefined
        if (vhost === null || vhost === undefined) return <span className="text-sm text-muted-foreground">-</span>
        return <span className="text-sm font-mono">{vhost ? "true" : "false"}</span>
      },
    },
    {
      accessorKey: "tags",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tags" />
      ),
      cell: ({ row }) => {
        const tags = (row.getValue("tags") as string[] | null | undefined) || []
        if (!tags.length) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, idx) => (
              <Badge
                key={idx}
                variant={/xss|sqli|idor|rce|ssrf|lfi|rfi|xxe|csrf|open.?redirect|interesting/i.test(tag) ? "destructive" : "secondary"}
                className="text-xs"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: "responseTime",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Response Time" />
      ),
      cell: ({ row }) => {
        const rt = row.getValue("responseTime") as number | null | undefined
        if (rt === null || rt === undefined) {
          return <span className="text-muted-foreground text-sm">-</span>
        }
        const formatted = `${rt.toFixed(4)}s`
        return <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatted}</span>
      },
    },
    {
      accessorKey: "discoveredAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Discovered At" />
      ),
      cell: ({ row }) => {
        const discoveredAt = row.getValue("discoveredAt") as string | undefined
        return <div className="text-sm">{discoveredAt ? formatDate(discoveredAt) : "-"}</div>
      },
    },
  ]
}
