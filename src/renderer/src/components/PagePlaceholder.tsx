import type { ReactNode } from 'react'

interface PagePlaceholderProps {
  title: string
  description: string
  comingIn?: string
  children?: ReactNode
}

/**
 * Standard shell for a not-yet-built module. Scrum 01 ships only placeholders;
 * later scrums replace the body of each page.
 */
export default function PagePlaceholder({
  title,
  description,
  comingIn,
  children
}: PagePlaceholderProps): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </header>

      {children ?? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This module is part of the foundation shell.
          </p>
          {comingIn && (
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gloria-accent">
              {comingIn}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
