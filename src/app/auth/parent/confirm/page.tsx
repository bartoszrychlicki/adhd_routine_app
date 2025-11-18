import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase"
import { ensureParentProfile } from "@/lib/auth/ensure-parent-profile"

type ParentConfirmPageProps = {
  searchParams: Promise<{
    code?: string
  }>
}

type ErrorVariant = "missing-code" | "invalid-code"

export const metadata: Metadata = {
  title: "Potwierdzanie adresu email",
  description: "Aktywuj konto rodzica i dokończ konfigurację rodziny.",
}

function ConfirmationError({ variant, details }: { variant: ErrorVariant; details?: string | null }) {
  const copy =
    variant === "missing-code"
      ? {
          title: "Brakuje kodu potwierdzającego",
          description:
            "Link aktywacyjny jest niekompletny. Otwórz ponownie wiadomość od Supabase Auth i kliknij przycisk potwierdzający w całości.",
        }
      : {
          title: "Nie udało się aktywować konta",
          description:
            details ??
            "Kod potwierdzający wygasł lub został już wykorzystany. Zaloguj się, aby poprosić o nowy link lub wyślij go ponownie z formularza rejestracji.",
        }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-6">
      <Card className="w-full border-slate-800/70 bg-slate-950/60 text-slate-100 backdrop-blur">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertCircle className="size-5 text-amber-300" aria-hidden />
            {copy.title}
          </CardTitle>
          <CardDescription className="text-sm text-slate-200/80">{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/auth/parent">Przejdź do logowania</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-slate-800/60 text-white">
            <Link href="/auth/parent/register">Wyślij link ponownie</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ParentConfirmPage({ searchParams }: ParentConfirmPageProps) {
  const params = await searchParams
  const code = typeof params.code === "string" ? params.code : null
  const error = typeof params.error === "string" ? params.error : null
  const errorDescription =
    typeof params.error_description === "string" ? decodeURIComponent(params.error_description) : null

  if (!code) {
    if (error) {
      return <ConfirmationError variant="invalid-code" details={errorDescription} />
    }

    return <ConfirmationError variant="missing-code" />
  }

  const supabase = await createSupabaseServerClient({ allowCookiePersistence: true })
  const {
    data,
    error: exchangeError,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.session) {
    console.error("[ParentConfirm] Failed to exchange code for session", { exchangeError })
    return <ConfirmationError variant="invalid-code" details={errorDescription} />
  }

  await ensureParentProfile(data.user)
  redirect("/onboarding/family")
}
