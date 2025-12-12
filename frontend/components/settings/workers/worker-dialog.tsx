"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useCreateWorker, useUpdateWorker } from "@/hooks/use-workers"
import type { WorkerNode } from "@/types/worker.types"

// 表单验证 Schema
const formSchema = z.object({
  name: z.string().min(1, "请输入节点名称").max(100, "名称不能超过100个字符"),
  ipAddress: z.string()
    .min(1, "请输入 IP 地址")
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      "请输入有效的 IP 地址"
    ),
  sshPort: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1, "请输入用户名"),
  password: z.string().optional(),
})

// 显式定义表单类型以解决类型推断问题
type FormValues = {
  name: string
  ipAddress: string
  sshPort: number
  username: string
  password?: string
}

interface WorkerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worker?: WorkerNode | null
}

export function WorkerDialog({ open, onOpenChange, worker }: WorkerDialogProps) {
  const createWorker = useCreateWorker()
  const updateWorker = useUpdateWorker()
  const isEditing = !!worker
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any, // 绕过类型检查问题
    defaultValues: {
      name: "",
      ipAddress: "",
      sshPort: 22,
      username: "root",
      password: "",
    },
  })

  // 填充表单数据
  useEffect(() => {
    if (open && worker) {
      form.reset({
        name: worker.name,
        ipAddress: worker.ipAddress,
        sshPort: worker.sshPort,
        username: worker.username,
        password: "", // 编辑时不回显密码
      })
    } else if (open && !worker) {
      form.reset({
        name: "",
        ipAddress: "",
        sshPort: 22,
        username: "root",
        password: "",
      })
    }
  }, [open, worker, form])

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && worker) {
        await updateWorker.mutateAsync({
          id: worker.id,
          data: {
            name: values.name,
            sshPort: values.sshPort,
            username: values.username,
            password: values.password || undefined, // 如果为空则不传
          }
        })
      } else {
        if (!values.password) {
          form.setError("password", { message: "请输入 SSH 密码" })
          return
        }
        await createWorker.mutateAsync({
          name: values.name,
          ipAddress: values.ipAddress,
          sshPort: values.sshPort,
          username: values.username,
          password: values.password,
        })
      }
      form.reset()
      onOpenChange(false)
    } catch (error) {
      // 错误已在 hook 中处理
    }
  }

  const isPending = createWorker.isPending || updateWorker.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑扫描节点" : "添加扫描节点"}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "修改节点的 SSH 连接信息" 
              : "输入远程 VPS 的 SSH 连接信息，添加后可通过「管理部署」一键部署扫描环境"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>节点名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: VPS-US-1" {...field} />
                  </FormControl>
                  <FormDescription>
                    用于识别节点的名称
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP 地址</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="例如: 192.168.1.100" 
                      {...field} 
                      disabled={isEditing} // 编辑时 IP 禁用
                    />
                  </FormControl>
                  {isEditing && (
                    <FormDescription>IP 地址不可修改</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sshPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SSH 端口</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SSH 密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={isEditing ? "留空保持不变" : "输入 SSH 密码"} {...field} />
                  </FormControl>
                  <FormDescription>
                    {isEditing ? "如需修改密码请输入新密码" : "密码仅用于部署，不会明文存储"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending 
                  ? (isEditing ? "保存中..." : "创建中...") 
                  : (isEditing ? "保存修改" : "创建节点")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
