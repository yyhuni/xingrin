"use client"

import { useParams } from "next/navigation"
import { DirectoriesView } from "@/components/directories/directories-view"

export default function TargetDirectoriesPage() {
  const { id } = useParams<{ id: string }>()
  const targetId = Number(id)

  return (
    <div className="px-4 lg:px-6">
      <DirectoriesView targetId={targetId} />
    </div>
  )
}
