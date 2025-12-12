"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { VulnerabilityService } from "@/services/vulnerability.service"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { IconExternalLink } from "@tabler/icons-react"
import type { VulnerabilitySeverity } from "@/types/vulnerability.types"

// 统一的漏洞严重程度颜色配置（与图表一致）
const severityConfig: Record<VulnerabilitySeverity, { label: string; className: string }> = {
  critical: { label: "严重", className: "bg-red-600 text-white hover:bg-red-600" },
  high: { label: "高危", className: "bg-orange-500 text-white hover:bg-orange-500" },
  medium: { label: "中危", className: "bg-yellow-500 text-white hover:bg-yellow-500" },
  low: { label: "低危", className: "bg-blue-500 text-white hover:bg-blue-500" },
  info: { label: "信息", className: "bg-gray-500 text-white hover:bg-gray-500" },
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function RecentVulnerabilities() {
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-vulnerabilities"],
    queryFn: () => VulnerabilityService.getAllVulnerabilities({ page: 1, pageSize: 5 }),
  })

  const vulnerabilities = data?.results ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>最近漏洞</CardTitle>
          <CardDescription>最近发现的安全漏洞</CardDescription>
        </div>
        <Link 
          href="/vulnerabilities/" 
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          查看全部
          <IconExternalLink className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : vulnerabilities.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            暂无漏洞数据
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>发现时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vulnerabilities.map((vuln: any) => (
                  <TableRow 
                    key={vuln.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/vulnerabilities/?id=${vuln.id}`)}
                  >
                    <TableCell>
                      <Badge className={severityConfig[vuln.severity as VulnerabilitySeverity]?.className}>
                        {severityConfig[vuln.severity as VulnerabilitySeverity]?.label ?? vuln.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vuln.source}</Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[120px] truncate">
                      {vuln.vulnType}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {vuln.url}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatTime(vuln.discoveredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
