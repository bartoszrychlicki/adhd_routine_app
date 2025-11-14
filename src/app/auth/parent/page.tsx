import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, ShieldCheck } from "lucide-react"

import { ParentLoginForm } from "@/components/auth/parent-login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getActiveProfile } from "@/lib/auth/get-active-profile"

type ParentLoginPageProps = {
  searchParams?: {
    status?: string
  }
}

export const metadata: Metadata = {
  title: "Logowanie rodzica",
  description: "Zaloguj się do panelu rodzica, aby zarządzać rutynami i nagrodami dziecka.",
}

export default async function ParentLoginPage({ searchParams }: ParentLoginPageProps) {
  const activeProfile = await getActiveProfile()
  const logoutSuccess = searchParams?.status === "logged_out"

  if (activeProfile?.role === "parent" || activeProfile?.role === "admin") {
    redirect("/parent/dashboard")
  }

  if (activeProfile?.role === "child") {
    redirect("/child/routines")
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Wróć do wyboru roli
          </Link>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Zaloguj się do panelu rodzica
            </h1>
            <p className="max-w-2xl text-base text-slate-200/80">
              Panel pozwala konfigurować rutyny, dzieci i katalog nagród. Dostęp uzyskasz poprzez dane konta
              utworzonego podczas onboardingu.
            </p>
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4 text-sm text-slate-200/80">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-emerald-500/20 p-2 text-emerald-300">
                  <ShieldCheck className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-slate-100">Weryfikacja dwuetapowa</p>
                  <p>
                    Po pięciu błędnych próbach wpisania hasła konto zostanie tymczasowo zablokowane. Otrzymasz
                    instrukcje resetu na adres email.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md flex-1 space-y-4">
          {logoutSuccess ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Pomyślnie wylogowano. Możesz zalogować się ponownie, aby wrócić do panelu rodzica.
            </div>
          ) : null}
          <ParentLoginForm />
        </div>
      </div>

      <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Dostęp dla Eryka</CardTitle>
          <CardDescription className="text-sm text-slate-200/80">
            Aby dziecko mogło się zalogować, wygeneruj token lub PIN w sekcji „Dzieci” po zalogowaniu.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-200/80">
          Tokeny dzieci są ważne przez 2 godziny. Możesz je dezaktywować w dowolnym momencie, aby zablokować
          dostęp.
        </CardContent>
      </Card>
    </div>
  )
}
