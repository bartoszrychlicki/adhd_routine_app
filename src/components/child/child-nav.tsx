"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gift, Medal, Rows } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  isActive: (pathname: string) => boolean
}

const navItems: NavItem[] = [
  {
    href: "/child/routines",
    label: "Rutyny",
    icon: <Rows className="size-5" aria-hidden />,
    isActive: (pathname) =>
      pathname === "/child" || pathname.startsWith("/child/home") || pathname.startsWith("/child/routines"),
  },
  {
    href: "/child/rewards",
    label: "Nagrody",
    icon: <Gift className="size-5" aria-hidden />,
    isActive: (pathname) => pathname.startsWith("/child/rewards"),
  },
  {
    href: "/child/profile",
    label: "Profil",
    icon: <Medal className="size-5" aria-hidden />,
    isActive: (pathname) => pathname.startsWith("/child/profile"),
  },
]

export function ChildNav() {
  const pathname = usePathname()

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between rounded-full border border-violet-500/40 bg-violet-900/60 px-5 py-3 text-sm text-violet-100 shadow-lg shadow-violet-900/50 backdrop-blur">
        {navItems.map((item) => {
          const active = item.isActive(pathname)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex flex-col items-center gap-1 rounded-full px-2 py-1 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-200",
                active ? "text-white" : "text-violet-200/80"
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border border-transparent bg-transparent",
                  active ? "border-white/70 bg-white/10" : ""
                )}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className="text-[11px] uppercase tracking-wide">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
