"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

type CopyState = "idle" | "success" | "error"

type ChildTokenCopyButtonProps = {
  loginLink: string
}

export function ChildTokenCopyButton({ loginLink }: ChildTokenCopyButtonProps) {
  const [status, setStatus] = useState<CopyState>("idle")

  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        setStatus("idle")
      }, 2000)

      return () => clearTimeout(timer)
    }

    return undefined
  }, [status])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(loginLink)
      setStatus("success")
    } catch (error) {
      console.warn("[ChildTokenCopyButton] Clipboard write failed", error)
      setStatus("error")
    }
  }

  const isSuccess = status === "success"

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="icon"
        variant={isSuccess ? "secondary" : "outline"}
        className="size-8 border-slate-700/60 text-slate-300 hover:text-white"
        onClick={handleCopy}
        aria-label="Skopiuj link"
      >
        {isSuccess ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </Button>
    </div>
  )
}
