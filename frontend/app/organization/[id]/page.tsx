"use client"

import React from "react"
import { OrganizationDetailView } from "@/components/organization/organization-detail-view"

/**
 * 组织详情页面
 * 显示组织的统计信息和资产列表
 */
export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = React.use(params)

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <OrganizationDetailView organizationId={resolvedParams.id} />
    </div>
  )
}
