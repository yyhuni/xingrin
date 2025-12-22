"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import type { WebSite } from "@/types/website.types"
import { TruncatedCell, TruncatedUrlCell } from "@/components/ui/truncated-cell"

/**
 * 数据表格列头组件 - 支持排序
 */
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
        <ChevronUp className="h-4 w-4" />
      ) : isSorted === "desc" ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronsUpDown className="h-4 w-4" />
      )}
    </Button>
  )
}

/**
 * Body Preview 单元格组件 - 最多显示3行，超出折叠，点击展开查看完整内容
 */
function BodyPreviewCell({ value }: { value: string | null | undefined }) {
  const [expanded, setExpanded] = React.useState(false)
  
  if (!value) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <div 
        className={`text-sm text-muted-foreground break-all leading-relaxed whitespace-normal cursor-pointer hover:text-foreground transition-colors ${!expanded ? 'line-clamp-3' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? "点击收起" : "点击展开"}
      >
        {value}
      </div>
      {value.length > 100 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline self-start"
        >
          {expanded ? "收起" : "展开"}
        </button>
      )}
    </div>
  )
}

interface CreateWebSiteColumnsProps {
  formatDate: (dateString: string) => string
}

export function createWebSiteColumns({
  formatDate,
}: CreateWebSiteColumnsProps): ColumnDef<WebSite>[] {
  return [
    {
      id: "select",
      size: 40,
      minSize: 40,
      maxSize: 40,
      enableResizing: false,
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
      size: 400,
      minSize: 200,
      maxSize: 700,
      cell: ({ row }) => {
        const url = row.getValue("url") as string
        return <TruncatedUrlCell value={url} />
      },
    },
    {
      accessorKey: "host",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Host" />
      ),
      size: 200,
      minSize: 100,
      maxSize: 250,
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("host")} maxLength="host" mono />
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      size: 150,
      minSize: 100,
      maxSize: 300,
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("title")} maxLength="title" />
      ),
    },
    {
      accessorKey: "statusCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      size: 80,
      minSize: 60,
      maxSize: 100,
      cell: ({ row }) => {
        const statusCode = row.getValue("statusCode") as number
        if (!statusCode) return "-"
        
        let variant: "default" | "secondary" | "destructive" | "outline" = "default"
        if (statusCode >= 200 && statusCode < 300) {
          variant = "default"
        } else if (statusCode >= 300 && statusCode < 400) {
          variant = "secondary"
        } else if (statusCode >= 400) {
          variant = "destructive"
        }
        
        return <Badge variant={variant}>{statusCode}</Badge>
      },
    },
    {
      accessorKey: "contentLength",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Content Length" />
      ),
      size: 100,
      minSize: 80,
      maxSize: 150,
      cell: ({ row }) => {
        const contentLength = row.getValue("contentLength") as number
        if (!contentLength) return "-"
        return contentLength.toString()
      },
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      size: 150,
      minSize: 100,
      maxSize: 300,
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("location")} maxLength="location" />
      ),
    },
    {
      accessorKey: "webserver",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Web Server" />
      ),
      size: 120,
      minSize: 80,
      maxSize: 200,
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("webserver")} maxLength="webServer" />
      ),
    },
    {
      accessorKey: "contentType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Content Type" />
      ),
      size: 120,
      minSize: 80,
      maxSize: 200,
      cell: ({ row }) => (
        <TruncatedCell value={row.getValue("contentType")} maxLength="contentType" />
      ),
    },
    {
      accessorKey: "tech",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Technologies" />
      ),
      size: 200,
      minSize: 150,
      cell: ({ row }) => {
        const tech = row.getValue("tech") as string[]
        if (!tech || tech.length === 0) return <span className="text-sm text-muted-foreground">-</span>

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {tech.map((technology, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {technology}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: "bodyPreview",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Body Preview" />
      ),
      size: 350,
      minSize: 250,
      cell: ({ row }) => (
        <BodyPreviewCell value={row.getValue("bodyPreview")} />
      ),
    },
    {
      accessorKey: "vhost",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="VHost" />
      ),
      size: 80,
      minSize: 60,
      maxSize: 100,
      cell: ({ row }) => {
        const vhost = row.getValue("vhost") as boolean | null
        if (vhost === null) return "-"
        return (
          <Badge variant={vhost ? "default" : "secondary"} className="text-xs">
            {vhost ? "true" : "false"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "discoveredAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Discovered At" />
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      cell: ({ row }) => {
        const discoveredAt = row.getValue("discoveredAt") as string
        return <div className="text-sm">{discoveredAt ? formatDate(discoveredAt) : "-"}</div>
      },
    },
  ]
}
