import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { systemLogService } from "@/services/system-log.service"

export function useSystemLogs(options?: { lines?: number; enabled?: boolean }) {
  const hadErrorRef = useRef(false)

  const query = useQuery({
    queryKey: ["system", "logs", { lines: options?.lines ?? null }],
    queryFn: () => systemLogService.getSystemLogs({ lines: options?.lines }),
    enabled: options?.enabled ?? true,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    retry: false,
  })

  useEffect(() => {
    if (query.isError && !hadErrorRef.current) {
      hadErrorRef.current = true
      toast.error("系统日志获取失败，请检查后端接口")
    }

    if (query.isSuccess && hadErrorRef.current) {
      hadErrorRef.current = false
      toast.success("系统日志连接已恢复")
    }
  }, [query.isError, query.isSuccess])

  return query
}
