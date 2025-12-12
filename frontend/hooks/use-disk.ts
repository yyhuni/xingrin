import { useQuery } from '@tanstack/react-query'
import { getDiskStats } from '@/services/disk.service'

export function useDiskStats() {
  return useQuery({
    queryKey: ['system', 'disk-stats'],
    queryFn: () => getDiskStats(),
    refetchInterval: 5000,
  })
}
