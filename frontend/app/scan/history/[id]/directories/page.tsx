"use client"

import { useParams } from "next/navigation"
import { DirectoriesView } from "@/components/directories/directories-view"

export default function ScanDirectoriesPage() {
  const { id } = useParams<{ id: string }>()
  const scanId = Number(id)

  return (
    <div className="px-4 lg:px-6">
      <DirectoriesView scanId={scanId} />
    </div>
  )
}
