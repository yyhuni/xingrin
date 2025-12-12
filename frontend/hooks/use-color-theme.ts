/**
 * 颜色主题切换 hook
 * 管理主题色（不是亮暗模式）
 */
import { useEffect, useState, useCallback } from 'react'

// 可用的颜色主题（colors 数组用于预览）
export const COLOR_THEMES = [
  { id: 'vercel', name: 'Vercel', color: '#000000', colors: ['#000000', '#ffffff', '#666666', '#999999'] },
  { id: 'violet-bloom', name: 'Violet Bloom', color: '#7c3aed', colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'] },
  { id: 'bubblegum', name: 'Bubblegum', color: '#d946a8', colors: ['#d946a8', '#ec4899', '#f472b6', '#f9a8d4'] },
  { id: 'quantum-rose', name: 'Quantum Rose', color: '#e11d48', colors: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af'] },
  { id: 'clean-slate', name: 'Clean Slate', color: '#3b82f6', colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'] },
  { id: 'cosmic-night', name: 'Cosmic Night', color: '#6366f1', colors: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'] },
  { id: 'candyland', name: 'Candyland', color: '#f5a5b8', colors: ['#f5a5b8', '#9dd5f5', '#f9e87c', '#f5a5c8'] },
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
 * 应用颜色主题到 DOM
 */
function applyTheme(themeId: ColorThemeId) {
  if (typeof window === 'undefined') return
  
  const root = document.documentElement
  root.setAttribute('data-theme', themeId)
  
  console.log('应用主题:', themeId, '当前 html:', root.getAttribute('data-theme'), root.className)
}

/**
 * 颜色主题 hook
 */
export function useColorTheme() {
  const [theme, setThemeState] = useState<ColorThemeId>('vercel')
  const [mounted, setMounted] = useState(false)

  // 初始化
  useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    applyTheme(stored)
    setMounted(true)
  }, [])

  // 切换主题
  const setTheme = useCallback((newTheme: ColorThemeId) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }, [])

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
