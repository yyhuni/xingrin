"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { VulnerabilityService } from "@/services/vulnerability.service"
import type {
  Vulnerability,
  VulnerabilitySeverity,
  GetVulnerabilitiesParams,
} from "@/types/vulnerability.types"
import type { PaginationInfo } from "@/types/common.types"

export const vulnerabilityKeys = {
  all: ["vulnerabilities"] as const,
  list: (params: GetVulnerabilitiesParams) =>
    [...vulnerabilityKeys.all, "list", params] as const,
  byScan: (scanId: number, params: GetVulnerabilitiesParams) =>
    [...vulnerabilityKeys.all, "scan", scanId, params] as const,
  byTarget: (targetId: number, params: GetVulnerabilitiesParams) =>
    [...vulnerabilityKeys.all, "target", targetId, params] as const,
}

/** 获取所有漏洞 */
export function useAllVulnerabilities(
  params?: GetVulnerabilitiesParams,
  options?: { enabled?: boolean },
) {
  const defaultParams: GetVulnerabilitiesParams = {
    page: 1,
    pageSize: 10,
    ...params,
  }

  return useQuery({
    queryKey: vulnerabilityKeys.list(defaultParams),
    queryFn: () => VulnerabilityService.getAllVulnerabilities(defaultParams),
    enabled: options?.enabled ?? true,
    select: (response: any) => {
      const items = (response?.results ?? []) as any[]

      const vulnerabilities: Vulnerability[] = items.map((item) => {
        let severity = (item.severity || "info") as
          | VulnerabilitySeverity
          | "unknown"
        if (severity === "unknown") {
          severity = "info"
        }

        let cvssScore: number | undefined
        if (typeof item.cvssScore === "number") {
          cvssScore = item.cvssScore
        } else if (item.cvssScore != null) {
          const num = Number(item.cvssScore)
          cvssScore = Number.isNaN(num) ? undefined : num
        }

        const discoveredAt: string = item.discoveredAt

        return {
          id: item.id,
          vulnType: item.vulnType || "unknown",
          url: item.url || "",
          description: item.description || "",
          severity: severity as VulnerabilitySeverity,
          source: item.source || "scan",
          cvssScore,
          rawOutput: item.rawOutput || {},
          discoveredAt,
        }
      })

      const pagination: PaginationInfo = {
        total: response?.total ?? 0,
        page: response?.page ?? defaultParams.page ?? 1,
        pageSize:
          response?.pageSize ??
          response?.page_size ??
          defaultParams.pageSize ??
          10,
        totalPages:
          response?.totalPages ??
          response?.total_pages ??
          0,
      }

      return { vulnerabilities, pagination }
    },
    placeholderData: keepPreviousData,
  })
}

export function useScanVulnerabilities(
  scanId: number,
  params?: GetVulnerabilitiesParams,
  options?: { enabled?: boolean },
) {
  const defaultParams: GetVulnerabilitiesParams = {
    page: 1,
    pageSize: 10,
    ...params,
  }

  return useQuery({
    queryKey: vulnerabilityKeys.byScan(scanId, defaultParams),
    queryFn: () =>
      VulnerabilityService.getVulnerabilitiesByScanId(scanId, defaultParams),
    enabled: options?.enabled !== undefined ? options.enabled : !!scanId,
    select: (response: any) => {
      const items = (response?.results ?? []) as any[]

      const vulnerabilities: Vulnerability[] = items.map((item) => {
        let severity = (item.severity || "info") as
          | VulnerabilitySeverity
          | "unknown"
        if (severity === "unknown") {
          severity = "info"
        }

        let cvssScore: number | undefined
        if (typeof item.cvssScore === "number") {
          cvssScore = item.cvssScore
        } else if (item.cvssScore != null) {
          const num = Number(item.cvssScore)
          cvssScore = Number.isNaN(num) ? undefined : num
        }

        const discoveredAt: string = item.discoveredAt

        return {
          id: item.id,
          vulnType: item.vulnType || "unknown",
          url: item.url || "",
          description: item.description || "",
          severity: severity as VulnerabilitySeverity,
          source: item.source || "scan",
          cvssScore,
          rawOutput: item.rawOutput || {},
          discoveredAt,
        }
      })

      const pagination: PaginationInfo = {
        total: response?.total ?? 0,
        page: response?.page ?? defaultParams.page ?? 1,
        pageSize:
          response?.pageSize ??
          response?.page_size ??
          defaultParams.pageSize ??
          10,
        totalPages:
          response?.totalPages ??
          response?.total_pages ??
          0,
      }

      return { vulnerabilities, pagination }
    },
    placeholderData: keepPreviousData,
  })
}

export function useTargetVulnerabilities(
  targetId: number,
  params?: GetVulnerabilitiesParams,
  options?: { enabled?: boolean },
) {
  const defaultParams: GetVulnerabilitiesParams = {
    page: 1,
    pageSize: 10,
    ...params,
  }

  return useQuery({
    queryKey: vulnerabilityKeys.byTarget(targetId, defaultParams),
    queryFn: () =>
      VulnerabilityService.getVulnerabilitiesByTargetId(targetId, defaultParams),
    enabled: options?.enabled !== undefined ? options.enabled : !!targetId,
    select: (response: any) => {
      const items = (response?.results ?? []) as any[]

      const vulnerabilities: Vulnerability[] = items.map((item) => {
        let severity = (item.severity || "info") as
          | VulnerabilitySeverity
          | "unknown"
        if (severity === "unknown") {
          severity = "info"
        }

        let cvssScore: number | undefined
        if (typeof item.cvssScore === "number") {
          cvssScore = item.cvssScore
        } else if (item.cvssScore != null) {
          const num = Number(item.cvssScore)
          cvssScore = Number.isNaN(num) ? undefined : num
        }

        const discoveredAt: string = item.discoveredAt

        return {
          id: item.id,
          vulnType: item.vulnType || "unknown",
          url: item.url || "",
          description: item.description || "",
          severity: severity as VulnerabilitySeverity,
          source: item.source || "scan",
          target: item.target ?? targetId,
          cvssScore,
          rawOutput: item.rawOutput || {},
          discoveredAt,
        }
      })

      const pagination: PaginationInfo = {
        total: response?.total ?? 0,
        page: response?.page ?? defaultParams.page ?? 1,
        pageSize:
          response?.pageSize ??
          response?.page_size ??
          defaultParams.pageSize ??
          10,
        totalPages:
          response?.totalPages ??
          response?.total_pages ??
          0,
      }

      return { vulnerabilities, pagination }
    },
    placeholderData: keepPreviousData,
  })
}
