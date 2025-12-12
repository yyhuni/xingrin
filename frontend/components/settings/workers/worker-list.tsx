"use client"

import { useState } from "react"
import {
  IconPlus,
  IconServer,
  IconTerminal2,
  IconTrash,
  IconEdit,
  IconCloud,
  IconCloudOff,
  IconClock,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Status, StatusIndicator, StatusLabel } from "@/components/ui/shadcn-io/status"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Banner,
  BannerIcon,
  BannerTitle,
  BannerAction,
  BannerClose,
} from "@/components/ui/shadcn-io/banner"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkers, useDeleteWorker } from "@/hooks/use-workers"
import type { WorkerNode, WorkerStatus } from "@/types/worker.types"
import { WorkerDialog } from "./worker-dialog"
import { DeployTerminalDialog } from "./deploy-terminal-dialog"
import { Rocket } from "lucide-react"

// 后端状态 -> shadcn 状态映射
const STATUS_MAP: Record<WorkerStatus, 'online' | 'offline' | 'maintenance' | 'degraded'> = {
  online: 'online',
  offline: 'offline',
  pending: 'maintenance',
  deploying: 'degraded',
}

// 状态中文标签
const STATUS_LABEL: Record<WorkerStatus, string> = {
  online: '运行中',
  offline: '离线',
  pending: '等待部署',
  deploying: '部署中',
}

// 统计卡片组件
function StatsCards({ workers }: { workers: WorkerNode[] }) {
  const total = workers.length
  const online = workers.filter(w => w.status === 'online').length
  const offline = workers.filter(w => w.status === 'offline').length
  const pending = workers.filter(w => w.status === 'pending').length

  const stats = [
    { label: '总节点', value: total, icon: IconServer, color: 'text-foreground' },
    { label: '在线', value: online, icon: IconCloud, color: 'text-emerald-600' },
    { label: '离线', value: offline, icon: IconCloudOff, color: 'text-red-500' },
    { label: '等待部署', value: pending, icon: IconClock, color: 'text-amber-500' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// 快速开始引导横幅
function QuickStartBanner() {
  const [helpOpen, setHelpOpen] = useState(false)

  const steps = [
    { step: 1, title: '添加扫描节点', desc: '点击"添加节点"按钮，填写 VPS 服务器的 SSH 连接信息（IP、端口、用户名、密码）' },
    { step: 2, title: '部署扫描环境', desc: '点击"管理部署"按钮，系统会自动通过 SSH 在远程服务器上安装 Docker 和心跳agent' },
    { step: 3, title: '自动任务分发', desc: '部署完成后节点会自动上报心跳，扫描任务将根据负载自动分发到各节点并行执行' },
  ]

  return (
    <>
      <Banner inset className="mb-6">
        <BannerIcon icon={Rocket} />
        <BannerTitle>
          <span className="font-medium">分布式扫描：</span>
          <span className="opacity-90">添加 VPS 节点 → 一键部署 → 任务自动分发</span>
        </BannerTitle>
        <BannerAction onClick={() => setHelpOpen(true)}>
          了解更多
        </BannerAction>
        <BannerClose />
      </Banner>

      <AlertDialog open={helpOpen} onOpenChange={setHelpOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              什么是分布式扫描？
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p>
                  分布式扫描允许你将扫描任务分发到多个远程服务器（扫描节点）上并行执行，显著提高扫描效率。
                </p>
                <div className="space-y-3">
                  {steps.map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {item.step}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>知道了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Worker 卡片视图组件
function WorkerCardView({ 
  workers, 
  onEdit, 
  onManage, 
  onDelete 
}: { 
  workers: WorkerNode[]
  onEdit: (w: WorkerNode) => void
  onManage: (w: WorkerNode) => void
  onDelete: (w: WorkerNode) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {workers.map((worker) => (
        <Card key={worker.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <IconServer className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{worker.name}</CardTitle>
                    {worker.isLocal && (
                      <Badge variant="secondary" className="text-xs">本地</Badge>
                    )}
                  </div>
                  <Status status={STATUS_MAP[worker.status]} className="mt-1">
                    <StatusIndicator />
                    <StatusLabel>{STATUS_LABEL[worker.status]}</StatusLabel>
                  </Status>
                </div>
              </div>
              {/* 本地节点不显示编辑和删除按钮 */}
              {!worker.isLocal && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(worker)} title="编辑">
                    <IconEdit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(worker)} title="删除">
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 所有节点都显示 CPU 和内存 */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-center p-2 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">CPU</p>
                <p className="font-mono font-medium">
                  {worker.info?.cpuPercent != null ? `${worker.info.cpuPercent.toFixed(1)}%` : '-'}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">内存</p>
                <p className="font-mono font-medium">
                  {worker.info?.memoryPercent != null ? `${worker.info.memoryPercent.toFixed(1)}%` : '-'}
                </p>
              </div>
            </div>
            
            {/* 远程节点：额外显示连接信息和管理按钮 */}
            {!worker.isLocal && (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{worker.ipAddress}:{worker.sshPort}</span>
                  <span>•</span>
                  <span>{worker.username}</span>
                </div>
                
                <Button variant="outline" size="sm" className="w-full" onClick={() => onManage(worker)}>
                  <IconTerminal2 className="h-4 w-4 mr-1.5" />
                  管理部署
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// 空状态组件
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <IconServer className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">暂无扫描节点</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        添加远程 VPS 服务器作为扫描节点，开始使用分布式扫描功能，提升扫描效率
      </p>
      <Button onClick={onAdd}>
        <IconPlus className="h-4 w-4 mr-2" />
        添加第一个节点
      </Button>
    </div>
  )
}

export function WorkerList() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deployDialogOpen, setDeployDialogOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<WorkerNode | null>(null)
  const [workerToDeploy, setWorkerToDeploy] = useState<WorkerNode | null>(null)
  const [workerToDelete, setWorkerToDelete] = useState<WorkerNode | null>(null)

  const { data, isLoading, refetch } = useWorkers(page, pageSize)
  const deleteWorker = useDeleteWorker()

  const workers = data?.results || []
  const hasWorkers = workers.length > 0

  const handleAdd = () => {
    setSelectedWorker(null)
    setWorkerDialogOpen(true)
  }

  const handleEdit = (worker: WorkerNode) => {
    setSelectedWorker(worker)
    setWorkerDialogOpen(true)
  }

  const handleManage = (worker: WorkerNode) => {
    setWorkerToDeploy(worker)
    setDeployDialogOpen(true)
  }

  const handleDeleteClick = (worker: WorkerNode) => {
    setWorkerToDelete(worker)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (workerToDelete) {
      deleteWorker.mutate(workerToDelete.id)
      setDeleteDialogOpen(false)
      setWorkerToDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* 快速开始引导横幅 */}
      <QuickStartBanner />

      {/* 统计卡片 - 只在有 Worker 时显示 */}
      {hasWorkers && <StatsCards workers={workers} />}

      {/* 主内容卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconServer className="h-5 w-5" />
                Worker 节点
              </CardTitle>
              <CardDescription>管理分布式扫描节点，支持远程部署和监控</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAdd}>
                <IconPlus className="mr-1 h-4 w-4" />添加节点
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
            </div>
          ) : !hasWorkers ? (
            <EmptyState onAdd={handleAdd} />
          ) : (
            <WorkerCardView
              workers={workers}
              onEdit={handleEdit}
              onManage={handleManage}
              onDelete={handleDeleteClick}
            />
          )}
        </CardContent>
      </Card>

      {/* 弹窗 */}
      <WorkerDialog 
        open={workerDialogOpen} 
        onOpenChange={setWorkerDialogOpen} 
        worker={selectedWorker}
      />
      <DeployTerminalDialog
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
        worker={workerToDeploy}
        onDeployComplete={() => refetch()}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除 Worker 节点 "{workerToDelete?.name}" 吗？此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
