"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VulnerabilitiesDetailView } from "@/components/vulnerabilities/vulnerabilities-detail-view"
import { ScanHistoryList } from "@/components/scan/history"
import { IconBug, IconRadar } from "@tabler/icons-react"

export function DashboardActivityTabs() {
  return (
    <Tabs defaultValue="vulnerabilities" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="vulnerabilities" className="gap-1.5">
          <IconBug className="h-4 w-4" />
          漏洞
        </TabsTrigger>
        <TabsTrigger value="scans" className="gap-1.5">
          <IconRadar className="h-4 w-4" />
          扫描历史
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="vulnerabilities" className="mt-0">
        <VulnerabilitiesDetailView />
      </TabsContent>
      <TabsContent value="scans" className="mt-0">
        <ScanHistoryList />
      </TabsContent>
    </Tabs>
  )
}
