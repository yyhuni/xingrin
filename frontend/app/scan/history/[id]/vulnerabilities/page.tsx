"use client"

import React from "react"
import { useParams } from "next/navigation"
import { VulnerabilitiesDetailView } from "@/components/vulnerabilities"

export default function ScanHistoryVulnerabilitiesPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
      <VulnerabilitiesDetailView scanId={Number(id)} />
    </div>
  )
}
