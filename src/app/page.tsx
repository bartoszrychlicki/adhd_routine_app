import { redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Clock3, HeartHandshake } from "lucide-react"

import { NetworkStatusBanner } from "@/components/network-status-banner"
import { RoleCard } from "@/components/landing/role-card"
import { SecurityCallout } from "@/components/landing/security-callout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getActiveProfile } from "@/lib/auth/get-active-profile"

export const metadata: Metadata = {
  title: "Wybierz tryb",
  description: "Zaloguj się jako rodzic lub dziecko, aby rozpocząć pracę z Dziennikiem Rutyn.",
}

export default async function Home() {
  const activeProfile = await getActiveProfile()

  if (activeProfile?.role === "parent" || activeProfile?.role === "admin") {
    redirect("/parent/dashboard")
  }

  if (activeProfile?.role === "child") {
    redirect("/child/routines")
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.25),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(192,132,252,0.25),transparent_55%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 pb-16 pt-12 sm:gap-10 sm:px-10 lg:px-12">
        <NetworkStatusBanner />
        <section className="mt-6 flex flex-col gap-6 rounded-3xl border border-slate-800/50 bg-slate-900/40 p-8 backdrop-blur-md sm:gap-8 sm:p-10">
          <Badge
            variant="outline"
            className="w-fit border-slate-700/60 bg-slate-900/60 text-xs uppercase tracking-wide text-slate-200"
          >
            MVP • Dziennik Rutyn Eryka
          </Badge>
          <header className="space-y-4 sm:space-y-6">
            <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Wybierz, w jaki sposób chcesz rozpocząć dzień z Dziennikiem Rutyn
            </h1>
            <p className="max-w-2xl text-pretty text-base text-slate-200 sm:text-lg">
              Dla rodzica przygotowaliśmy panel do konfiguracji rutyn i nagród. Interfejs dziecka prowadzi przez
              zadania krok po kroku, motywując do szybkiego działania i śledząc punkty.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <RoleCard
              role="parent"
              href="/auth/parent"
              title="Jestem rodzicem"
              description="Zarządzaj rutynami, nagrodami i postępami Eryka w jednym miejscu."
              highlight="Pełna kontrola"
              features={[
                "Panel dzienny z podsumowaniem dziś i wczoraj",
                "Kopiowanie gotowych zadań z szablonów",
                "Konfiguracja katalogu nagród z obrazami",
              ]}
            />
            <RoleCard
              role="child"
              href="/auth/child"
              title="Jestem dzieckiem"
              description="Wejdź do grywalizowanego interfejsu rutyn i zdobywaj punkty za zadania."
              highlight="Tryb przygody"
              features={[
                "Pełna lista zadań z podświetleniem bieżącego kroku",
                "Timer z bonusem za rekord",
                "Sklep nagród z aktualnym saldem punktów",
              ]}
            />
          </div>

          <Card className="border-slate-800/60 bg-slate-900/40 text-slate-100 backdrop-blur">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-teal-500/20 p-2 text-teal-200">
                  <HeartHandshake className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-teal-200/90">
                    Potrzebujesz zaproszenia
                  </p>
                  <p className="text-base text-slate-200">
                    Aby korzystać z aplikacji, rodzic musi dodać Cię do swojej rodziny. Po zalogowaniu otrzymasz
                    indywidualny PIN lub link.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full border-slate-700/60 text-slate-100 sm:w-fit">
                <Link href="/auth/parent">
                  Dowiedz się, jak rozpocząć
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <SecurityCallout />

          <aside className="grid gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 text-sm text-slate-200 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-indigo-500/20 p-2 text-indigo-200">
                <Clock3 className="size-4" aria-hidden />
              </span>
              <p>
                Kolejna rutyna rozpocznie się w wybranym przez Ciebie oknie czasowym. Dziecko zobaczy licznik i
                otrzyma przypomnienie o zbliżającym się starcie.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-violet-500/20 p-2 text-violet-200">
                <ArrowRight className="size-4" aria-hidden />
              </span>
              <p>
                Po zalogowaniu rodzic automatycznie trafi do panelu, a dziecko do widoku rutyn. Możesz przełączać
                się między rolami w dowolnym momencie.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
