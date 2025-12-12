import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CommandService } from "@/services/command.service"
import type {
  GetCommandsRequest,
  CreateCommandRequest,
  UpdateCommandRequest,
  GetCommandsResponse,
  Command,
} from "@/types/command.types"
import { toast } from "sonner"

// 假数据
const MOCK_COMMANDS: Command[] = [
  {
    id: 1,
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
    toolId: 1,
    tool: {
      id: 1,
      name: "subfinder",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/projectdiscovery/subfinder",
      version: "v2.6.5",
      description: "Fast passive subdomain enumeration tool",
      categoryNames: ["subdomain", "recon"],
      directory: "",
      installCommand: "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
      updateCommand: "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
      versionCommand: "subfinder -version",
    },
    name: "subdomain_scan",
    displayName: "子域名扫描",
    description: "使用 subfinder 进行子域名扫描",
    commandTemplate: "subfinder -d {{domain}} -o {{output}}",
  },
  {
    id: 2,
    createdAt: "2024-01-16T11:20:00Z",
    updatedAt: "2024-01-16T11:20:00Z",
    toolId: 2,
    tool: {
      id: 2,
      name: "nmap",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/nmap/nmap",
      version: "7.94",
      description: "Network exploration tool and security / port scanner",
      categoryNames: ["port", "network"],
      directory: "",
      installCommand: "brew install nmap",
      updateCommand: "brew upgrade nmap",
      versionCommand: "nmap --version",
    },
    name: "port_scan",
    displayName: "端口扫描",
    description: "使用 nmap 进行端口扫描",
    commandTemplate: "nmap -sV -p- {{target}} -oX {{output}}",
  },
  {
    id: 3,
    createdAt: "2024-01-17T09:15:00Z",
    updatedAt: "2024-01-17T09:15:00Z",
    toolId: 1,
    tool: {
      id: 1,
      name: "subfinder",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/projectdiscovery/subfinder",
      version: "v2.6.5",
      description: "Fast passive subdomain enumeration tool",
      categoryNames: ["subdomain", "recon"],
      directory: "",
      installCommand: "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
      updateCommand: "go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest",
      versionCommand: "subfinder -version",
    },
    name: "fast_subdomain_scan",
    displayName: "快速子域名扫描",
    description: "使用 subfinder 快速扫描常见子域名",
    commandTemplate: "subfinder -d {{domain}} -silent -o {{output}}",
  },
  {
    id: 4,
    createdAt: "2024-01-18T14:45:00Z",
    updatedAt: "2024-01-18T14:45:00Z",
    toolId: 3,
    tool: {
      id: 3,
      name: "nuclei",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/projectdiscovery/nuclei",
      version: "v3.1.4",
      description: "Fast and customisable vulnerability scanner",
      categoryNames: ["vulnerability", "scanner"],
      directory: "",
      installCommand: "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
      updateCommand: "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
      versionCommand: "nuclei -version",
    },
    name: "vulnerability_scan",
    displayName: "漏洞扫描",
    description: "使用 nuclei 进行漏洞扫描",
    commandTemplate: "nuclei -u {{target}} -severity critical,high,medium -o {{output}}",
  },
  {
    id: 5,
    createdAt: "2024-01-19T16:00:00Z",
    updatedAt: "2024-01-19T16:00:00Z",
    toolId: 4,
    tool: {
      id: 4,
      name: "katana",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/projectdiscovery/katana",
      version: "v1.0.4",
      description: "Next-generation crawling and spidering framework",
      categoryNames: ["crawler", "recon"],
      directory: "",
      installCommand: "go install github.com/projectdiscovery/katana/cmd/katana@latest",
      updateCommand: "go install github.com/projectdiscovery/katana/cmd/katana@latest",
      versionCommand: "katana -version",
    },
    name: "web_crawl",
    displayName: "网页爬取",
    description: "使用 katana 爬取网页链接",
    commandTemplate: "katana -u {{target}} -d 3 -o {{output}}",
  },
  {
    id: 6,
    createdAt: "2024-01-20T10:30:00Z",
    updatedAt: "2024-01-20T10:30:00Z",
    toolId: 2,
    tool: {
      id: 2,
      name: "nmap",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/nmap/nmap",
      version: "7.94",
      description: "Network exploration tool and security / port scanner",
      categoryNames: ["port", "network"],
      directory: "",
      installCommand: "brew install nmap",
      updateCommand: "brew upgrade nmap",
      versionCommand: "nmap --version",
    },
    name: "service_detect",
    displayName: "服务识别",
    description: "使用 nmap 进行服务版本识别",
    commandTemplate: "nmap -sV {{target}} -oX {{output}}",
  },
  {
    id: 7,
    createdAt: "2024-01-21T13:20:00Z",
    updatedAt: "2024-01-21T13:20:00Z",
    toolId: 5,
    tool: {
      id: 5,
      name: "dirsearch",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/maurosoria/dirsearch",
      version: "v0.4.3",
      description: "Web path scanner",
      categoryNames: ["directory", "recon"],
      directory: "",
      installCommand: "pip3 install dirsearch",
      updateCommand: "pip3 install --upgrade dirsearch",
      versionCommand: "dirsearch --version",
    },
    name: "dir_scan",
    displayName: "目录扫描",
    description: "使用 dirsearch 进行目录扫描",
    commandTemplate: "dirsearch -u {{target}} -e php,html,js -o {{output}}",
  },
  {
    id: 8,
    createdAt: "2024-01-22T15:10:00Z",
    updatedAt: "2024-01-22T15:10:00Z",
    toolId: 3,
    tool: {
      id: 3,
      name: "nuclei",
      type: "opensource",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      repoUrl: "https://github.com/projectdiscovery/nuclei",
      version: "v3.1.4",
      description: "Fast and customisable vulnerability scanner",
      categoryNames: ["vulnerability", "scanner"],
      directory: "",
      installCommand: "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
      updateCommand: "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
      versionCommand: "nuclei -version",
    },
    name: "full_vulnerability_scan",
    displayName: "完整漏洞扫描",
    description: "使用 nuclei 进行全面漏洞扫描",
    commandTemplate: "nuclei -u {{target}} -t nuclei-templates/ -o {{output}}",
  },
]

/**
 * 获取命令列表（使用假数据）
 */
export function useCommands(params: GetCommandsRequest = {}) {
  return useQuery({
    queryKey: ["commands", params],
    queryFn: async (): Promise<GetCommandsResponse> => {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const page = params.page || 1
      const pageSize = params.pageSize || 10
      
      // 如果有 toolId 过滤
      let filteredCommands = MOCK_COMMANDS
      if (params.toolId) {
        filteredCommands = MOCK_COMMANDS.filter(cmd => cmd.toolId === params.toolId)
      }
      
      const totalCount = filteredCommands.length
      const totalPages = Math.ceil(totalCount / pageSize)
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const commands = filteredCommands.slice(startIndex, endIndex)
      
      return {
        commands,
        page,
        pageSize,
        total: totalCount,
        totalPages,
        // 兼容字段（向后兼容）
        page_size: pageSize,
        total_count: totalCount,
        total_pages: totalPages,
      }
    },
  })
}

/**
 * 获取单个命令（使用假数据）
 */
export function useCommand(id: number) {
  return useQuery({
    queryKey: ["command", id],
    queryFn: async (): Promise<Command | undefined> => {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 300))
      return MOCK_COMMANDS.find(cmd => cmd.id === id)
    },
    enabled: !!id,
  })
}

/**
 * 创建命令
 */
export function useCreateCommand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommandRequest) => CommandService.createCommand(data),
    onSuccess: () => {
      toast.success("命令创建成功")
      queryClient.invalidateQueries({ queryKey: ["commands"] })
    },
    onError: (error: any) => {
      console.error("创建命令失败:", error)
      toast.error("命令创建失败")
    },
  })
}

/**
 * 更新命令
 */
export function useUpdateCommand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCommandRequest }) =>
      CommandService.updateCommand(id, data),
    onSuccess: () => {
      toast.success("命令更新成功")
      queryClient.invalidateQueries({ queryKey: ["commands"] })
      queryClient.invalidateQueries({ queryKey: ["command"] })
    },
    onError: (error: any) => {
      console.error("更新命令失败:", error)
      toast.error("命令更新失败")
    },
  })
}

/**
 * 删除命令
 */
export function useDeleteCommand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => CommandService.deleteCommand(id),
    onSuccess: () => {
      toast.success("命令删除成功")
      queryClient.invalidateQueries({ queryKey: ["commands"] })
    },
    onError: (error: any) => {
      console.error("删除命令失败:", error)
      toast.error("命令删除失败")
    },
  })
}

/**
 * 批量删除命令（使用假数据）
 */
export function useBatchDeleteCommands() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: number[]) => {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // 从假数据中过滤掉被删除的命令
      const deletedCount = ids.filter(id => 
        MOCK_COMMANDS.some(cmd => cmd.id === id)
      ).length
      
      // 模拟删除（实际上不会真的删除假数据）
      return {
        data: {
          deletedCount: deletedCount
        }
      }
    },
    onSuccess: (response) => {
      toast.success(`成功删除 ${response.data?.deletedCount} 个命令`)
      queryClient.invalidateQueries({ queryKey: ["commands"] })
    },
    onError: (error: any) => {
      console.error("批量删除命令失败:", error)
      toast.error("批量删除命令失败")
    },
  })
}
