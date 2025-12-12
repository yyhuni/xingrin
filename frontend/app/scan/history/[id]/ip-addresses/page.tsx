"use client"

import React from "react"
import { useParams } from "next/navigation"
import { IPAddressesView } from "@/components/ip-addresses"

export default function ScanHistoryIPsPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="px-4 lg:px-6">
      <IPAddressesView scanId={Number(id)} />
    </div>
  )
}
