import { AllTargetsDetailView } from "@/components/target/all-targets-detail-view"
import { Target } from "lucide-react"

export default function AllTargetsPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target />
            目标
          </h2>
          <p className="text-muted-foreground">
            管理系统中的所有目标信息
          </p>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 lg:px-6">
        <AllTargetsDetailView />
      </div>
    </div>
  )
}
