"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ParentDashboardDatePickerProps = {
  value: string
  min: string
  max: string
}

export function ParentDashboardDatePicker({ value, min, max }: ParentDashboardDatePickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function updateDate(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (nextValue === max) {
      params.delete("date")
    } else {
      params.set("date", nextValue)
    }

    const query = params.toString()

    startTransition(() => {
      router.push(query ? `/parent/dashboard?${query}` : "/parent/dashboard")
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300/70">Zakres daty</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(event) => updateDate(event.target.value || max)}
            disabled={isPending}
            className="w-full cursor-pointer border-slate-800/60 bg-slate-900/60 pl-10 text-sm text-white"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={value === max || isPending}
          className="border-slate-700/60 bg-slate-900/60 text-white"
          onClick={() => updateDate(max)}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden />
          Dziś
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Możesz przejrzeć dane maksymalnie 30 dni wstecz (od {min} do {max}).
      </p>
    </div>
  )
}
