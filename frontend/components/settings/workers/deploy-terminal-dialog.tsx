"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { IconRocket, IconEye, IconTrash, IconRefresh } from "@tabler/icons-react"
import type { WorkerNode } from "@/types/worker.types"

interface DeployTerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worker: WorkerNode | null
  onDeployComplete?: () => void
}

// 自动根据当前页面 URL 生成 WebSocket URL
const getWsBaseUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:8888'
  
  // 优先使用环境变量
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL
  }
  
  // 根据当前页面协议和域名自动生成
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}`
}

export function DeployTerminalDialog({
  open,
  onOpenChange,
  worker,
  onDeployComplete,
}: DeployTerminalDialogProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 本地 worker 状态，用于实时更新按钮显示
  const [localStatus, setLocalStatus] = useState<string | null>(null)
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false)
  
  // 使用本地状态或传入的 worker 状态
  const currentStatus = localStatus || worker?.status
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // 初始化 xterm
  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || terminalInstanceRef.current) return
    
    const { Terminal } = await import('@xterm/xterm')
    const { FitAddon } = await import('@xterm/addon-fit')
    const { WebLinksAddon } = await import('@xterm/addon-web-links')
    
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12, // 减小字体
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        black: '#32344a',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#ad8ee6',
        cyan: '#449dab',
        white: '#787c99',
      },
    })
    
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    
    terminal.open(terminalRef.current)
    fitAddon.fit()
    
    terminalInstanceRef.current = terminal
    fitAddonRef.current = fitAddon
    
    // 显示连接提示
    terminal.writeln('\x1b[90m正在建立 SSH 连接...\x1b[0m')
    
    // 监听窗口大小变化
    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)
    
    // 自动连接 WebSocket
    connectWs()
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [worker])

  // 连接 WebSocket
  const connectWs = useCallback(() => {
    if (!worker || !terminalInstanceRef.current) return
    
    const terminal = terminalInstanceRef.current
    // 如果已有连接先关闭
    if (wsRef.current) {
        wsRef.current.close()
    }
    
    const ws = new WebSocket(`${getWsBaseUrl()}/ws/workers/${worker.id}/deploy/`)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws
    
    ws.onopen = () => {
      terminal.writeln('\x1b[32m✓ WebSocket 已连接\x1b[0m')
      // 后端会自动开始 SSH 连接
    }
    
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // 二进制数据 - 终端输出
        const decoder = new TextDecoder()
        terminal.write(decoder.decode(event.data))
      } else {
        // JSON 消息
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            setIsConnected(true)
            setError(null)
            // 绑定终端输入
            terminal.onData((data: string) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'input', data }))
              }
            })
            // 发送终端大小
            ws.send(JSON.stringify({
                type: 'resize',
                cols: terminal.cols,
                rows: terminal.rows,
            }))
          } else if (data.type === 'error') {
            terminal.writeln(`\x1b[31m✗ ${data.message}\x1b[0m`)
            setError(data.message)
          } else if (data.type === 'status') {
            // 更新本地状态以实时显示正确的按钮
            setLocalStatus(data.status)
            // 任何状态变化都刷新父组件列表
            onDeployComplete?.()
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    ws.onclose = () => {
      terminal.writeln('')
      terminal.writeln('\x1b[33m连接已关闭\x1b[0m')
      setIsConnected(false)
    }
    
    ws.onerror = () => {
      terminal.writeln('\x1b[31m✗ WebSocket 连接失败\x1b[0m')
      setError('连接失败')
    }
  }, [worker, onDeployComplete])

  // 发送终端大小变化
  useEffect(() => {
    if (!isConnected || !wsRef.current || !terminalInstanceRef.current) return
    
    const terminal = terminalInstanceRef.current
    const handleResize = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    }
    
    terminal.onResize?.(handleResize)
  }, [isConnected])

  // 打开时初始化
  useEffect(() => {
    if (open && worker) {
      // 延迟初始化，确保 DOM 已渲染
      const timer = setTimeout(initTerminal, 100)
      return () => clearTimeout(timer)
    }
  }, [open, worker, initTerminal])

  // 关闭时清理
  const handleClose = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.dispose()
      terminalInstanceRef.current = null
    }
    fitAddonRef.current = null
    setIsConnected(false)
    setError(null)
    setLocalStatus(null) // 重置本地状态
    // 关闭时刷新父组件列表，确保状态同步
    onDeployComplete?.()
    onOpenChange(false)
  }

  // 执行部署脚本（后台运行）
  const handleDeploy = () => {
    if (!wsRef.current || !isConnected) return
    setLocalStatus('deploying') // 立即更新为部署中状态
    onDeployComplete?.() // 刷新父组件列表
    wsRef.current.send(JSON.stringify({ type: 'deploy' }))
  }

  // 查看部署进度（attach 到 tmux 会话）
  const handleAttach = () => {
    if (!wsRef.current || !isConnected) return
    wsRef.current.send(JSON.stringify({ type: 'attach' }))
  }

  // 卸载 Agent（打开确认弹窗）
  const handleUninstallClick = () => {
    if (!wsRef.current || !isConnected) return
    setUninstallDialogOpen(true)
  }

  // 确认卸载
  const handleUninstallConfirm = () => {
    if (!wsRef.current || !isConnected) return
    setUninstallDialogOpen(false)
    wsRef.current.send(JSON.stringify({ type: 'uninstall' }))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[50vw] max-w-[50vw] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden [&>button]:hidden">
        {/* 终端标题栏 - macOS 风格 */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a1b26] border-b border-[#32344a]">
          <div className="flex items-center gap-3">
            {/* 红黄绿按钮 */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleClose}
                className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors"
                title="关闭"
              />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            {/* 标题 */}
            <span className="text-sm text-[#a9b1d6] font-medium">
              {worker?.username}@{worker?.ipAddress}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#9ece6a]' : 'bg-[#f7768e]'}`} />
            <span className="text-xs text-[#a9b1d6]">{isConnected ? '已连接' : '未连接'}</span>
          </div>
        </div>

        {/* xterm 终端容器 */}
        <div 
          ref={terminalRef} 
          className="flex-1 overflow-hidden bg-[#1a1b26]"
        />

        {/* 底部操作栏 - 根据状态显示不同按钮 */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a1b26] border-t border-[#32344a]">
          {/* 左侧：状态提示 */}
          <div className="text-xs text-[#565f89]">
            {!isConnected && '等待连接...'}
            {isConnected && currentStatus === 'pending' && '节点未部署，点击右侧按钮开始部署扫描环境'}
            {isConnected && currentStatus === 'deploying' && '正在部署中，点击查看进度'}
            {isConnected && currentStatus === 'online' && '节点运行正常'}
            {isConnected && currentStatus === 'offline' && '节点离线，可尝试重新部署'}
          </div>
          
          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2">
            {!isConnected && (
              <button 
                onClick={connectWs}
                className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-[#32344a] text-[#a9b1d6] hover:bg-[#414868] transition-colors"
              >
                <IconRefresh className="mr-1.5 h-4 w-4" />
                重新连接
              </button>
            )}
            {isConnected && worker && (
              <>
                {/* 未部署 -> 显示"开始部署" */}
                {currentStatus === 'pending' && (
                  <button 
                    onClick={handleDeploy}
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-[#7aa2f7] text-[#1a1b26] hover:bg-[#7aa2f7]/80 transition-colors"
                  >
                    <IconRocket className="mr-1.5 h-4 w-4" />
                    开始部署
                  </button>
                )}
                
                {/* 部署中 -> 显示"查看进度" */}
                {currentStatus === 'deploying' && (
                  <button 
                    onClick={handleAttach}
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-[#7aa2f7] text-[#1a1b26] hover:bg-[#7aa2f7]/80 transition-colors"
                  >
                    <IconEye className="mr-1.5 h-4 w-4" />
                    查看进度
                  </button>
                )}
                
                {/* 已部署(online/offline) -> 显示"重新部署"和"卸载" */}
                {(currentStatus === 'online' || currentStatus === 'offline') && (
                  <>
                    <button 
                      onClick={handleDeploy}
                      className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-[#32344a] text-[#a9b1d6] hover:bg-[#414868] transition-colors"
                    >
                      <IconRocket className="mr-1.5 h-4 w-4" />
                      重新部署
                    </button>
                    <button 
                      onClick={handleUninstallClick}
                      className="inline-flex items-center px-3 py-1.5 text-sm rounded-md bg-[#32344a] text-[#f7768e] hover:bg-[#414868] transition-colors"
                    >
                      <IconTrash className="mr-1.5 h-4 w-4" />
                      卸载
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* 卸载确认弹窗 */}
      <AlertDialog open={uninstallDialogOpen} onOpenChange={setUninstallDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认卸载</AlertDialogTitle>
            <AlertDialogDescription>
              确定要在远程主机上卸载 Agent 并删除相关容器吗？此操作不会卸载 Docker。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUninstallConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              卸载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
