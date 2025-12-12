import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PackageOpen, Settings, ArrowRight } from "lucide-react"
import Link from "next/link"

/**
 * 工具概览页面
 * 显示开源工具和自定义工具的入口
 */
export default function ToolsPage() {
  // 功能模块
  const modules = [
    {
      title: "字典管理",
      description: "管理目录扫描等使用的字典文件",
      href: "/tools/wordlists/",
      icon: PackageOpen,
      status: "available",
      stats: {
        total: "-",
        active: "-",
      },
    },
    {
      title: "Nuclei 模板",
      description: "浏览本地 Nuclei 模板结构及内容",
      href: "/tools/nuclei/",
      icon: Settings,
      status: "available",
      stats: {
        total: "-",
        active: "-",
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">工具</h2>
          <p className="text-muted-foreground">
            管理与扫描相关的辅助资源，如字典等
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="px-4 lg:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Card key={module.title} className="relative hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <module.icon className="h-5 w-5" />
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                  </div>
                  {module.status === "coming-soon" && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                      即将上线
                    </span>
                  )}
                </div>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 统计信息 */}
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">总数：</span>
                      <span className="font-semibold ml-1">{module.stats.total}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">活跃：</span>
                      <span className="font-semibold ml-1 text-green-600">{module.stats.active}</span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  {module.status === "available" ? (
                    <Link href={module.href}>
                      <Button className="w-full">
                        进入管理
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">
                      敬请期待
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 快速操作 */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>
              常用的工具操作
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link href="/tools/wordlists/">
                <Button variant="outline" size="sm">
                  <PackageOpen className="h-4 w-4" />
                  字典管理
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
