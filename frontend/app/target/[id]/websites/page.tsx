"use client"

import { useParams } from "next/navigation"
import { WebSitesView } from "@/components/websites/websites-view"

export default function WebSitesPage() {
  const { id } = useParams<{ id: string }>()
  const targetId = Number(id)

  return (
    <div className="px-4 lg:px-6">
      <WebSitesView targetId={targetId} />
    </div>
  )
}
