"use client"

import { useColorTheme, COLOR_THEMES, ColorThemeId } from "@/hooks/use-color-theme"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { IconPalette, IconCheck } from "@tabler/icons-react"

/**
 * 颜色主题切换器
 */
export function ColorThemeSwitcher() {
  const { theme, setTheme, mounted } = useColorTheme()

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <IconPalette className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <IconPalette className="h-4 w-4" />
          <span className="sr-only">切换主题色</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {COLOR_THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => {
              console.log('切换主题到:', t.id)
              setTheme(t.id as ColorThemeId)
            }}
            className="flex items-center gap-2"
          >
            {/* 颜色预览色块 */}
            <div className="flex items-center gap-1">
              {t.colors.map((c, i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span>{t.name}</span>
            {theme === t.id && <IconCheck className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
