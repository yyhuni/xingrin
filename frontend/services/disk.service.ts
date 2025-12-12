import { api } from '@/lib/api-client'
import type { DiskStats } from '@/types/disk.types'

export async function getDiskStats(): Promise<DiskStats> {
  const res = await api.get<DiskStats>('/system/disk-stats/')
  return res.data
}
