import Link from "next/link"
import { ArrowRight, ShieldCheck, Sparkles, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type RoleCardProps = {
  role: "parent" | "child"
  href: string
  title: string
  description: string
  features: string[]
  highlight?: string
  disabled?: boolean
}

const roleIcon: Record<RoleCardProps["role"], typeof User> = {
  parent: ShieldCheck,
  child: Sparkles,
}

const roleGradient: Record<RoleCardProps["role"], string> = {
  parent:
    "bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.45),rgba(37,99,235,0.25)_45%,rgba(15,23,42,0.85)_90%)]",
  child:
    "bg-[radial-gradient(circle_at_top,rgba(249,168,212,0.55),rgba(233,113,193,0.35)_40%,rgba(66,21,84,0.85)_90%)]",
}

export function RoleCard({
  role,
  href,
  title,
  description,
  features,
  highlight,
  disabled,
}: RoleCardProps) {
  const Icon = roleIcon[role]

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-none transition-transform duration-150 hover:-translate-y-1 hover:shadow-xl focus-within:-translate-y-1 focus-within:shadow-xl",
        roleGradient[role]
      )}
    >
      {/* Dark overlay for better text contrast */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />
      
      {highlight ? (
        <Badge
          variant="secondary"
          className="absolute right-4 top-4 z-10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md"
        >
          {highlight}
        </Badge>
      ) : null}
      <CardHeader className="relative z-10 space-y-4 pb-4 text-white">
        <div className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
          <Icon className="size-6" aria-hidden />
        </div>
        <CardTitle className="text-2xl font-semibold text-white drop-shadow-lg">{title}</CardTitle>
        <CardDescription className="text-slate-100 drop-shadow-md">{description}</CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 flex-1">
        <ul className="space-y-2 text-sm text-slate-100 drop-shadow-md">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 leading-6">
              <span aria-hidden>•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="relative z-10 mt-6">
        <Button
          asChild
          size="lg"
          className="group w-full bg-white/90 text-slate-950 hover:bg-white"
          disabled={disabled}
          aria-disabled={disabled}
        >
          <Link href={href}>
            <span className="flex items-center justify-center gap-2">
              {role === "parent" ? "Zaloguj się jako rodzic" : "Zaloguj się jako dziecko"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
