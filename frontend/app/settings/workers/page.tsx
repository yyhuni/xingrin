"use client"

import { WorkerList } from "@/components/settings/workers"

export default function WorkersPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">扫描节点</h1>
          <p className="text-muted-foreground">
            管理分布式扫描节点，支持远程 VPS 自动部署
          </p>
        </div>
      </div>
      <WorkerList />
    </div>
  )
}
