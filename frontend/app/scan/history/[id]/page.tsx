"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function ScanHistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/scan/history/${id}/subdomain/`)
  }, [id, router])

  return null
}
