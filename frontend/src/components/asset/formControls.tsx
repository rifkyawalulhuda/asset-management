import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-[3px] block text-[10.5px] font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error
        ? <p role="alert" className="mt-0.5 text-[10px] font-medium text-rose-600">{error}</p>
        : hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

export function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string
  description?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-[10.5px] text-slate-500">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="grid gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-2">{children}</div>
    </section>
  )
}
