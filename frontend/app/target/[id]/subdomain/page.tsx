"use client"

import React from "react"
import { useParams } from "next/navigation"
import { SubdomainsDetailView } from "@/components/subdomains"

export default function TargetSubdomainPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="px-4 lg:px-6">
      <SubdomainsDetailView targetId={parseInt(id)} />
    </div>
  )
}
