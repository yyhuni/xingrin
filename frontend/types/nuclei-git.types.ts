export type NucleiGitAuthType = "none" | "token"

export interface NucleiGitSettings {
  repoUrl: string
  authType: NucleiGitAuthType
  authToken: string
}

export type GetNucleiGitSettingsResponse = NucleiGitSettings

export type UpdateNucleiGitSettingsRequest = NucleiGitSettings

export interface UpdateNucleiGitSettingsResponse {
  message: string
  settings: NucleiGitSettings
}
