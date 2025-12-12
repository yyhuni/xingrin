"use client"

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { IconBrandDiscord, IconMail, IconBrandSlack, IconScan, IconShieldCheck, IconWorld, IconSettings } from '@tabler/icons-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useNotificationSettings, useUpdateNotificationSettings } from '@/hooks/use-notification-settings'

const schema = z
  .object({
    discord: z.object({
      enabled: z.boolean(),
      webhookUrl: z.string().url('请输入有效的 Discord Webhook URL').or(z.literal('')),
    }),
    categories: z.object({
      scan: z.boolean(),         // 扫描任务
      vulnerability: z.boolean(), // 漏洞发现
      asset: z.boolean(),        // 资产发现
      system: z.boolean(),       // 系统消息
    }),
  })
  .superRefine((val, ctx) => {
    if (val.discord.enabled) {
      if (!val.discord.webhookUrl || val.discord.webhookUrl.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '启用 Discord 时必须填写 Webhook URL',
          path: ['discord', 'webhookUrl'],
        })
      }
    }
  })

const NOTIFICATION_CATEGORIES = [
  {
    key: 'scan' as const,
    label: '扫描任务',
    description: '扫描启动、进度、完成、失败等通知',
    icon: IconScan,
  },
  {
    key: 'vulnerability' as const,
    label: '漏洞发现',
    description: '发现安全漏洞时通知',
    icon: IconShieldCheck,
  },
  {
    key: 'asset' as const,
    label: '资产发现',
    description: '发现新子域名、IP、端口等资产',
    icon: IconWorld,
  },
  {
    key: 'system' as const,
    label: '系统消息',
    description: '系统级通知和公告',
    icon: IconSettings,
  },
]

export default function NotificationSettingsPage() {
  const { data, isLoading } = useNotificationSettings()
  const updateMutation = useUpdateNotificationSettings()

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: data ?? {
      discord: { enabled: false, webhookUrl: '' },
      categories: {
        scan: true,
        vulnerability: true,
        asset: true,
        system: false,
      },
    },
  })

  const onSubmit = (values: z.infer<typeof schema>) => {
    updateMutation.mutate(values)
  }

  const discordEnabled = form.watch('discord.enabled')

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">通知设置</h1>
        <p className="text-muted-foreground mt-1">配置系统通知的推送渠道和接收偏好</p>
      </div>

      <Tabs defaultValue="channels" className="w-full">
        <TabsList>
          <TabsTrigger value="channels">推送渠道</TabsTrigger>
          <TabsTrigger value="preferences">通知偏好</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* 推送渠道 Tab */}
            <TabsContent value="channels" className="space-y-4 mt-4">
              {/* Discord 卡片 */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5865F2]/10">
                        <IconBrandDiscord className="h-5 w-5 text-[#5865F2]" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Discord</CardTitle>
                        <CardDescription>将通知推送到你的 Discord 频道</CardDescription>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="discord.enabled"
                      render={({ field }) => (
                        <FormControl>
                          <Switch 
                            checked={field.value} 
                            onCheckedChange={field.onChange} 
                            disabled={isLoading || updateMutation.isPending} 
                          />
                        </FormControl>
                      )}
                    />
                  </div>
                </CardHeader>
                {discordEnabled && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    <FormField
                      control={form.control}
                      name="discord.webhookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://discord.com/api/webhooks/..." 
                              {...field} 
                              disabled={isLoading || updateMutation.isPending} 
                            />
                          </FormControl>
                          <FormDescription>
                            在 Discord 频道设置中创建 Webhook 并粘贴地址
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                )}
              </Card>

              {/* 邮件 - 即将支持 */}
              <Card className="opacity-60">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <IconMail className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">邮件</CardTitle>
                          <Badge variant="secondary" className="text-xs">即将支持</Badge>
                        </div>
                        <CardDescription>通过邮件接收通知</CardDescription>
                      </div>
                    </div>
                    <Switch disabled />
                  </div>
                </CardHeader>
              </Card>

              {/* 飞书/钉钉/企微 - 即将支持 */}
              <Card className="opacity-60">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <IconBrandSlack className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">飞书 / 钉钉 / 企微</CardTitle>
                          <Badge variant="secondary" className="text-xs">即将支持</Badge>
                        </div>
                        <CardDescription>推送到企业协作平台</CardDescription>
                      </div>
                    </div>
                    <Switch disabled />
                  </div>
                </CardHeader>
              </Card>
            </TabsContent>

            {/* 通知偏好 Tab */}
            <TabsContent value="preferences" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">通知分类</CardTitle>
                  <CardDescription>选择你想要接收的通知类型</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <FormField
                      key={category.key}
                      control={form.control}
                      name={`categories.${category.key}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between py-3 border-b last:border-b-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <category.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <FormLabel className="text-sm font-medium cursor-pointer">
                                {category.label}
                              </FormLabel>
                              <FormDescription className="text-xs">
                                {category.description}
                              </FormDescription>
                            </div>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              disabled={isLoading || updateMutation.isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 保存按钮 */}
            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={updateMutation.isPending || isLoading}>
                保存设置
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  )
}
