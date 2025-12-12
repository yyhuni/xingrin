"use client"

import { useParams } from "next/navigation"
import { WebSitesView } from "@/components/websites/websites-view"

export default function ScanWebSitesPage() {
  const { id } = useParams<{ id: string }>()
  const scanId = Number(id)

  return (
    <div className="px-4 lg:px-6">
      <WebSitesView scanId={scanId} />
    </div>
  )
}
