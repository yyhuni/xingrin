"use client"

import React from "react"
import { useParams } from "next/navigation"
import { EndpointsDetailView } from "@/components/endpoints"

/**
 * 目标端点页面
 * 显示目标下的端点详情
 */
export default function TargetEndpointsPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="px-4 lg:px-6">
      <EndpointsDetailView targetId={parseInt(id)} />
    </div>
  )
}

