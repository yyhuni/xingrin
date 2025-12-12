"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * 目标详情页面（兼容旧路由）
 * 自动重定向到域名页面
 */
export default function TargetDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    // 重定向到子域名页面
    router.replace(`/target/${id}/subdomain/`)
  }, [id, router])

  return null
}

