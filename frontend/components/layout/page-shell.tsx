import { cn } from "@/lib/utils"

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("page-shell flex min-h-dvh flex-col", className)}>
      {children}
    </div>
  )
}

interface PageContentProps {
  children: React.ReactNode
  className?: string
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("page-content w-full py-8 pb-12", className)}>
      {children}
    </div>
  )
}
