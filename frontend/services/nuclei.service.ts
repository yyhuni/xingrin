import { api } from "@/lib/api-client"
import type {
  NucleiTemplateTreeNode,
  NucleiTemplateContent,
  NucleiTemplateTreeResponse,
  UploadNucleiTemplatePayload,
  SaveNucleiTemplatePayload,
} from "@/types/nuclei.types"

export async function getNucleiTemplateTree(): Promise<NucleiTemplateTreeNode[]> {
  const response = await api.get<NucleiTemplateTreeResponse>("/nuclei/templates/tree/")
  return response.data.roots || []
}

export async function getNucleiTemplateContent(path: string): Promise<NucleiTemplateContent> {
  const response = await api.get<NucleiTemplateContent>("/nuclei/templates/content/", {
    params: { path },
  })
  return response.data
}

export async function refreshNucleiTemplates(): Promise<void> {
  await api.post("/nuclei/templates/refresh/")
}

export async function saveNucleiTemplate(payload: SaveNucleiTemplatePayload): Promise<void> {
  await api.post("/nuclei/templates/save/", payload)
}

export async function uploadNucleiTemplate(payload: UploadNucleiTemplatePayload): Promise<void> {
  const formData = new FormData()
  formData.append("scope", payload.scope)
  formData.append("file", payload.file)

  await api.post("/nuclei/templates/upload/", formData, {
    headers: {
      "Content-Type": undefined,
    },
  })
}
