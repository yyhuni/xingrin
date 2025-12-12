"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateTimePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  label?: string
  placeholder?: string
  minDate?: Date
}

export function DateTimePicker({
  value,
  onChange,
  label = "执行时间",
  placeholder = "选择日期时间",
  minDate,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(value)
  const [time, setTime] = React.useState<string>(
    value ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}` : "02:00"
  )

  // 合并日期和时间
  const updateDateTime = React.useCallback((newDate: Date | undefined, newTime: string) => {
    if (!newDate) {
      onChange?.(undefined)
      return
    }

    const [hours, minutes] = newTime.split(":").map(Number)
    const dateTime = new Date(newDate)
    dateTime.setHours(hours || 0, minutes || 0, 0, 0)
    onChange?.(dateTime)
  }, [onChange])

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate)
    updateDateTime(newDate, time)
    setOpen(false)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value)
    updateDateTime(date, e.target.value)
  }

  // 格式化显示
  const displayDate = date
    ? date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : placeholder

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <Label className="px-1">{label}</Label>
      )}
      <div className="flex gap-3">
        {/* 日期选择 */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 justify-between font-normal"
            >
              {displayDate}
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={handleDateChange}
              disabled={minDate ? { before: minDate } : undefined}
            />
          </PopoverContent>
        </Popover>

        {/* 时间选择 */}
        <Input
          type="time"
          value={time}
          onChange={handleTimeChange}
          className="w-28 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  )
}
