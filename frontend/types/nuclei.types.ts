export type NucleiTemplateNodeType = "folder" | "file"

export interface NucleiTemplateTreeNode {
  type: NucleiTemplateNodeType
  name: string
  path: string
  children?: NucleiTemplateTreeNode[]
  templateId?: string
  severity?: string
  tags?: string[]
}

export interface NucleiTemplateTreeResponse {
  roots: NucleiTemplateTreeNode[]
}

export interface NucleiTemplateContent {
  path: string
  name: string
  templateId?: string
  severity?: string
  tags?: string[]
  content: string
}

export type NucleiTemplateScope = "custom" | "public"

export interface UploadNucleiTemplatePayload {
  scope: NucleiTemplateScope
  file: File
}

export interface SaveNucleiTemplatePayload {
  path: string
  content: string
}
