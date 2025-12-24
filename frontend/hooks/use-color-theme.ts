/**
 * 颜色主题切换 hook
 * 管理主题色（不是亮暗模式）
 */
import { useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'

// 可用的颜色主题（colors 数组用于预览，isDark 表示是否为暗色主题）
export const COLOR_THEMES = [
  { id: 'vercel', name: 'Vercel', color: '#000000', colors: ['#ffffff', '#000000', '#666666', '#999999'], isDark: false },
  { id: 'vercel-dark', name: 'Vercel Dark', color: '#000000', colors: ['#000000', '#ffffff', '#333333', '#666666'], isDark: true },
  { id: 'violet-bloom', name: 'Violet Bloom', color: '#7c3aed', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'], isDark: false },
  { id: 'bubblegum', name: 'Bubblegum', color: '#d946a8', colors: ['#d946a8', '#ec4899', '#f472b6', '#f9a8d4'], isDark: false },
  { id: 'quantum-rose', name: 'Quantum Rose', color: '#e11d48', colors: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af'], isDark: false },
  { id: 'clean-slate', name: 'Clean Slate', color: '#3b82f6', colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'], isDark: false },
  { id: 'cosmic-night', name: 'Cosmic Night', color: '#6366f1', colors: ['#1e1b4b', '#6366f1', '#818cf8', '#a5b4fc'], isDark: true },
  { id: 'cyberpunk-1', name: 'Cyberpunk', color: '#00ffff', colors: ['#0f172a', '#00ffff', '#a855f7', '#ec4899'], isDark: true },
] as const

export type ColorThemeId = typeof COLOR_THEMES[number]['id']

const STORAGE_KEY = 'color-theme'

/**
 * 获取当前颜色主题
 */
function getStoredTheme(): ColorThemeId {
  if (typeof window === 'undefined') return 'vercel'
  return (localStorage.getItem(STORAGE_KEY) as ColorThemeId) || 'vercel'
}

/**
 * 应用颜色主题到 DOM（仅设置 data-theme）
 */
function applyThemeAttribute(themeId: ColorThemeId) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', themeId)
}

/**
 * 颜色主题 hook
 */
export function useColorTheme() {
  const [theme, setThemeState] = useState<ColorThemeId>('vercel')
  const [mounted, setMounted] = useState(false)
  const { setTheme: setNextTheme } = useTheme()

  // 初始化
  useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    applyThemeAttribute(stored)
    // 同步 next-themes 亮暗模式
    const themeConfig = COLOR_THEMES.find(t => t.id === stored)
    setNextTheme(themeConfig?.isDark ? 'dark' : 'light')
    setMounted(true)
  }, [setNextTheme])

  // 切换主题
  const setTheme = useCallback((newTheme: ColorThemeId) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyThemeAttribute(newTheme)
    // 同步 next-themes 亮暗模式
    const themeConfig = COLOR_THEMES.find(t => t.id === newTheme)
    setNextTheme(themeConfig?.isDark ? 'dark' : 'light')
  }, [setNextTheme])

  // 获取当前主题信息
  const currentTheme = COLOR_THEMES.find(t => t.id === theme) || COLOR_THEMES[0]

  return {
    theme,
    setTheme,
    themes: COLOR_THEMES,
    currentTheme,
    mounted,
  }
}
