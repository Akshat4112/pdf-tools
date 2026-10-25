import { useEffect, useRef } from 'react'

/** Move focus only when a processing/outcome panel mounts, never on progress ticks. */
export function usePanelHeading() {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  return heading
}
