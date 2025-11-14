import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { LogOut, Menu, Settings, Sparkles } from "lucide-react"

import { NetworkStatusBanner } from "@/components/network-status-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getActiveProfile } from "@/lib/auth/get-active-profile"
import { createSupabaseServerClient } from "@/lib/supabase"
import { logoutParent } from "@/app/auth/parent/actions"

type ParentLayoutProps = {
  children: ReactNode
}

export default async function ParentLayout({ children }: ParentLayoutProps) {
  const activeProfile = await getActiveProfile()

  if (!activeProfile) {
    redirect("/auth/parent")
  }

  if (activeProfile.role === "child") {
    redirect("/child/routines")
  }

  let onboardingComplete = false

  if (activeProfile.familyId) {
    const supabase = await createSupabaseServerClient()
    const { data: familySettings } = await supabase
      .from("families")
      .select("settings")
      .eq("id", activeProfile.familyId)
      .maybeSingle()

    const settings = (familySettings?.settings as { onboarding?: { isComplete?: boolean } } | null) ?? null
    onboardingComplete = settings?.onboarding?.isComplete === true
  }

  return (
    <div className="relative isolate min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_60%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.16),transparent_55%)]" />
      <header className="flex items-center justify-between border-b border-slate-900/60 bg-slate-950/70 px-6 py-5 backdrop-blur sm:px-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="border border-slate-800/60 bg-slate-950/60 sm:hidden">
            <Menu className="size-4" aria-hidden />
            <span className="sr-only">Otwórz nawigację</span>
          </Button>
          <Link href="/" className="text-lg font-semibold">
            Dziennik Rutyn Eryka
          </Link>
          <Badge variant="outline" className="hidden border-slate-800/60 bg-slate-950/60 text-xs text-slate-200 sm:inline-flex">
            Tryb rodzica
          </Badge>
        </div>
        <nav className="hidden items-center gap-4 text-sm text-slate-200/80 sm:flex">
          <Link className="hover:text-white" href="/parent/dashboard">
            Dashboard
          </Link>
          <Link className="hover:text-white" href="/parent/routines">
            Rutyny
          </Link>
          <Link className="hover:text-white" href="/parent/rewards">
            Nagrody
          </Link>
          <Link className="hover:text-white" href="/parent/children">
            Profile dzieci
          </Link>
          <Link className="hover:text-white" href="/parent/settings">
            Ustawienia
          </Link>
          <Link className="hover:text-white" href="/error">
            Status systemu
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-sm text-slate-200/90">
          <Sparkles className="size-4 text-teal-200" aria-hidden />
          <span>{activeProfile.displayName}</span>
          <form action={logoutParent}>
            <Button
              variant="ghost"
              size="icon-sm"
              type="submit"
              className="border border-slate-800/60 bg-slate-950/60"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only">Wyloguj</span>
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16 pt-8 sm:px-10">
        <NetworkStatusBanner />
        <section className="rounded-3xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Panel rodzica</h1>
              <p className="text-sm text-slate-200/80">
                Monitoruj postępy rutyn, zarządzaj zadaniami i nagrodami dla swoich dzieci.
              </p>
            </div>
            {!onboardingComplete ? (
              <div className="flex gap-3">
                <Button variant="outline" className="border-slate-800/60 bg-slate-950/50" asChild>
                  <Link href="/onboarding/family">
                    <Settings className="mr-2 size-4" aria-hidden />
                    Onboarding
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {children}
      </main>
    </div>
  )
}
