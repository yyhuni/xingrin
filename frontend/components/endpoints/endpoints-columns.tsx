"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { MoreHorizontal, Eye, Trash2, ChevronsUpDown, ChevronUp, ChevronDown, Copy, Check } from "lucide-react"
import type { Endpoint } from "@/types/endpoint.types"
import { toast } from "sonner"

function CopyableCell({ 
  value, 
  maxWidth = "500px", 
  truncateLength = 60,
  successMessage = "已复制",
  className = "font-mono"
}: { 
  value: string | undefined | null
  maxWidth?: string
  truncateLength?: number
  successMessage?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  
  if (!value) {
    return <span className="text-muted-foreground text-sm">-</span>
  }
  
  const isLong = value.length > truncateLength
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }
  
  return (
    <div className="group inline-flex items-center gap-1" style={{ maxWidth }}>
      <TooltipProvider delayDuration={500} skipDelayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`text-sm truncate cursor-default ${className}`}>
              {value}
            </div>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            align="start"
            sideOffset={5}
            className={`text-xs ${className} ${isLong ? 'max-w-[500px] break-all' : 'whitespace-nowrap'}`}
          >
            {value}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider delayDuration={500} skipDelayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 flex-shrink-0 hover:bg-accent transition-opacity ${
                copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{copied ? '已复制!' : '点击复制'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

interface CreateColumnsProps {
  formatDate: (dateString: string) => string
  navigate: (path: string) => void
  handleDelete: (endpoint: Endpoint) => void
}

function EndpointRowActions({
  onView,
  onDelete,
}: {
  onView: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal />
          <span className="sr-only">打开菜单</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye />
          查看详情
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
  navigate,
  handleDelete,
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

        const maxLength = 40
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
                  <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    ···
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">完整 URL</h4>
                    <div className="text-xs break-all bg-muted p-2 rounded max-h-48 overflow-y-auto font-mono">
                      {url}
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
                <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    ···
                  </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">完整标题</h4>
                  <div className="text-sm break-all bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {title}
                  </div>
                </div>
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
                <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    ···
                  </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">完整 Location</h4>
                  <div className="text-sm break-all bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {location}
                  </div>
                </div>
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
                <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    ···
                  </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">完整 Web Server</h4>
                  <div className="text-sm break-all bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {webserver}
                  </div>
                </div>
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
                <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    ···
                  </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">完整响应体预览</h4>
                  <div className="text-sm break-all bg-muted p-2 rounded max-h-32 overflow-y-auto">
                    {bodyPreview}
                  </div>
                </div>
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
