import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  width?: number
  align?: 'left' | 'right'
  trigger: (api: { ref: RefObject<HTMLButtonElement | null>; toggle: () => void; open: boolean }) => ReactNode
  children: (api: { close: () => void }) => ReactNode
}

export default function Popover({ width = 320, align = 'left', trigger, children }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const place = useCallback(() => {
    const button = buttonRef.current
    const panel = panelRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const panelWidth = panel?.offsetWidth ?? width
    const panelHeight = panel?.offsetHeight ?? 360
    const preferred = align === 'right' ? rect.right - panelWidth : rect.left
    const left = Math.max(8, Math.min(preferred, window.innerWidth - panelWidth - 8))
    const below = rect.bottom + 6
    const top = below + panelHeight > window.innerHeight
      ? Math.max(8, rect.top - panelHeight - 6)
      : below
    setPos({ top, left })
  }, [align, width])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return (
    <>
      {trigger({ ref: buttonRef, toggle: () => setOpen(value => !value), open })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{ top: pos.top, left: pos.left, width }}
            className="fixed z-[80] flex max-h-[440px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white text-[11.5px] text-slate-800 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
          >
            {children({ close: () => setOpen(false) })}
          </div>,
          document.body,
        )}
    </>
  )
}