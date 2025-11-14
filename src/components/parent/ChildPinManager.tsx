"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { Eye, EyeOff, RefreshCcw, Save } from "lucide-react"

import { updatePinAction, type PinActionState } from "@/app/parent/children/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initialState: PinActionState = { status: "idle" }

function PinSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <>
          <RefreshCcw className="size-4 animate-spin" aria-hidden />
          Zapisywanie…
        </>
      ) : (
        <>
          <Save className="size-4" aria-hidden />
          Zapisz PIN
        </>
      )}
    </Button>
  )
}

function maskPin(pin: string, visible: boolean): string {
  if (visible) {
    return pin
  }
  return "•".repeat(Math.max(pin.length, 4))
}

type ChildPinManagerProps = {
  childId: string
  currentPin: string | null
}

export function ChildPinManager({ childId, currentPin }: ChildPinManagerProps) {
  const [state, formAction] = useActionState<PinActionState, FormData>(updatePinAction, initialState)
  const [showPin, setShowPin] = useState(false)
  const [formVisible, setFormVisible] = useState(false)

  useEffect(() => {
    setShowPin(false)
  }, [currentPin])

  useEffect(() => {
    if (state.status === "success") {
      setFormVisible(false)
    }
  }, [state.status])

  const pinLabel = currentPin ? maskPin(currentPin, showPin) : "Brak ustawionego PIN-u"

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 text-xs text-slate-200/80">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">PIN dziecka</p>
            <p className="text-xs text-slate-400">
              Udostępnij PIN dziecku wraz z linkiem logowania. Możesz w każdej chwili ustawić nowy kod.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-lg border border-slate-800/70 bg-slate-900/50 px-3 py-1.5 text-sm font-semibold text-white">
            <span>{pinLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="border border-slate-700/60 bg-slate-900/40 text-slate-200"
              disabled={!currentPin}
              onClick={() => setShowPin((prev) => !prev)}
              aria-label={showPin ? "Ukryj PIN" : "Pokaż PIN"}
            >
              {showPin ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border border-slate-700/60"
            onClick={() => setFormVisible((prev) => !prev)}
          >
            {formVisible ? "Ukryj formularz" : currentPin ? "Zmień PIN" : "Ustaw PIN"}
          </Button>
        </div>

        {formVisible ? (
          <form
            action={formAction}
            className="space-y-3"
            noValidate
          >
            <input type="hidden" name="childId" value={childId} />
            <input type="hidden" name="storePlainPin" value="true" />

            <div className="space-y-1">
              <label htmlFor={`pin-${childId}`} className="text-xs font-medium text-white">
                Nowy PIN (4–6 cyfr)
              </label>
              <Input
                id={`pin-${childId}`}
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                minLength={4}
                required
                placeholder="••••"
                autoComplete="one-time-code"
                className="bg-slate-900/60 text-sm"
              />
            </div>

            {state.status === "error" ? (
              <p className="text-xs text-amber-300" aria-live="assertive">
                {state.message ?? "Nie udało się zapisać PIN-u."}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <PinSubmitButton />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-slate-300"
                onClick={() => setFormVisible(false)}
              >
                Anuluj
              </Button>
            </div>
          </form>
        ) : null}

        {state.status === "success" ? (
          <p className="text-xs text-emerald-300" aria-live="polite">
            {state.message ?? "PIN został zaktualizowany."}
          </p>
        ) : null}
      </div>
    </div>
  )
}
