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
import { ChevronsUpDown, ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react"
import type { Endpoint } from "@/types/endpoint.types"
import { CopyablePopoverContent } from "@/components/ui/copyable-popover-content"

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
      cell: ({ row }) => {
        const url = row.getValue("url") as string | undefined

        if (!url) {
          return <span className="text-muted-foreground text-sm">-</span>
        }

        // 根据列宽度估算可显示字符数（font-mono 约 7px/字符，列宽 250px 左右）
        const maxLength = 32
        const isLong = url.length > maxLength
        const displayUrl = isLong ? url.substring(0, maxLength) + "..." : url

        return (
          <div className="flex items-center gap-1 w-[280px] min-w-[280px]">
            <span className="text-sm font-mono truncate">
              {displayUrl}
            </span>
            {isLong && (
              <Popover>
                <PopoverTrigger asChild>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-3">
                  <CopyablePopoverContent value={url} className="font-mono text-xs" />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        const title = row.getValue("title") as string | null | undefined
        if (!title) return <span className="text-sm">-</span>

        const maxLength = 30
        const isLong = title.length > maxLength
        const displayText = isLong ? title.substring(0, maxLength) : title

        if (!isLong) {
          return <span className="text-sm">{title}</span>
        }

        return (
          <div className="flex items-center gap-1">
            <span className="text-sm">{displayText}</span>
            <Popover>
              <PopoverTrigger asChild>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <CopyablePopoverContent value={title} />
              </PopoverContent>
            </Popover>
          </div>
        )
      },
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
      cell: ({ row }) => {
        const location = row.getValue("location") as string | undefined
        if (!location) return <span className="text-sm text-muted-foreground">-</span>

        const maxLength = 50
        const isLong = location.length > maxLength
        const displayText = isLong ? location.substring(0, maxLength) : location

        if (!isLong) {
          return <span className="text-sm">{location}</span>
        }

        return (
          <div className="flex items-center gap-1">
            <span className="text-sm">{displayText}</span>
            <Popover>
              <PopoverTrigger asChild>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <CopyablePopoverContent value={location} />
              </PopoverContent>
            </Popover>
          </div>
        )
      },
    },
    {
      accessorKey: "webserver",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Web Server" />
      ),
      cell: ({ row }) => {
        const webserver = row.getValue("webserver") as string | undefined
        if (!webserver) return <span className="text-sm text-muted-foreground">-</span>

        const maxLength = 20
        const isLong = webserver.length > maxLength
        const displayText = isLong ? webserver.substring(0, maxLength) : webserver

        if (!isLong) {
          return <span className="text-sm">{webserver}</span>
        }

        return (
          <div className="flex items-center gap-1">
            <span className="text-sm">{displayText}</span>
            <Popover>
              <PopoverTrigger asChild>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <CopyablePopoverContent value={webserver} />
              </PopoverContent>
            </Popover>
          </div>
        )
      },
    },
    {
      accessorKey: "contentType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Content Type" />
      ),
      cell: ({ row }) => {
        const ct = row.getValue("contentType") as string | null | undefined
        return ct ? <span className="text-sm">{ct}</span> : <span className="text-muted-foreground text-sm">-</span>
      },
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
      cell: ({ row }) => {
        const bodyPreview = row.getValue("bodyPreview") as string | undefined
        if (!bodyPreview) return <span className="text-sm text-muted-foreground">-</span>

        const maxLength = 30
        const isLong = bodyPreview.length > maxLength
        const displayText = isLong ? bodyPreview.substring(0, maxLength) : bodyPreview

        if (!isLong) {
          return <span className="text-sm">{bodyPreview}</span>
        }

        return (
          <div className="flex items-center gap-1">
            <span className="text-sm">{displayText}</span>
            <Popover>
              <PopoverTrigger asChild>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <CopyablePopoverContent value={bodyPreview} />
              </PopoverContent>
            </Popover>
          </div>
        )
      },
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
