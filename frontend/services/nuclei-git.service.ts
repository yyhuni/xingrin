import { api } from "@/lib/api-client"
import type {
  GetNucleiGitSettingsResponse,
  UpdateNucleiGitSettingsRequest,
  UpdateNucleiGitSettingsResponse,
} from "@/types/nuclei-git.types"

export class NucleiGitService {
  static async getSettings(): Promise<GetNucleiGitSettingsResponse> {
    const res = await api.get<GetNucleiGitSettingsResponse>("/settings/nuclei-templates-git/")
    return res.data
  }

  static async updateSettings(
    data: UpdateNucleiGitSettingsRequest
  ): Promise<UpdateNucleiGitSettingsResponse> {
    const res = await api.put<UpdateNucleiGitSettingsResponse>("/settings/nuclei-templates-git/", data)
    return res.data
  }
}
