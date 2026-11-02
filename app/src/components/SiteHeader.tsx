import { useLocale } from '../i18n'
import { hubForTool, hubPath, publicHref } from '../lib/categoryHubs'
import { useEffect, useRef, useState } from 'react'
import { SITE_BASE } from '../lib/seo'
import { CATEGORIES, TOOLS } from '../registry'
import { href, switchPageLocale } from '../router'
import { hasGermanPage, localizedPath } from '../lib/localizedRoutes'
import './SiteHeader.css'

/** Shared navigation never holds document or job state. */
export function SiteHeader() {
  const { t, locale, setLocale } = useLocale()
  const catalogHref = locale === 'de' ? `${SITE_BASE}de/` : SITE_BASE
  const toolHref = (path: string): string => locale === 'de' && hasGermanPage(path) ? localizedPath(path, 'de') : href(path)
  const englishFallback = (label: string): string => t(label) + (locale === 'de' ? ' (Englisch)' : '')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const close = () => {
      setOpen(false)
      root.current?.querySelectorAll('details[open]').forEach(detail => detail.removeAttribute('open'))
    }
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !(event.target instanceof Node) || !root.current?.contains(event.target)) return
      const detail = root.current.querySelector<HTMLDetailsElement>('details[open]')
      if (detail) {
        detail.open = false
        detail.querySelector('summary')?.focus()
      } else if (open) {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <header className="folio-header" ref={root}>
      <div className="folio-header-row">
        <a className="folio-home" href={catalogHref} aria-label={t("PDF Tools home")} onClick={() => {
          setOpen(false)
          root.current?.querySelectorAll('details[open]').forEach(detail => detail.removeAttribute('open'))
        }}>
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet={`${SITE_BASE}brand/logo-dark.svg`} />
            <img src={`${SITE_BASE}brand/logo-light.svg`} width="185" height="36" alt="" />
          </picture>
        </a>
        <button className="folio-menu-toggle" type="button" ref={toggle} aria-expanded={open}
          aria-controls="folio-navigation" onClick={() => setOpen(!open)}>
          {t(open ? 'Close' : 'Menu')} <span aria-hidden="true">{open ? '×' : '☰'}</span>
        </button>
        <nav id="folio-navigation" className={`folio-navigation${open ? ' is-open' : ''}`} aria-label={t("Main navigation")}
          onClick={event => {
            if ((event.target as HTMLElement).closest('a')) {
              setOpen(false)
              root.current?.querySelectorAll('details[open]').forEach(detail => detail.removeAttribute('open'))
            }
          }}>
          <a href={catalogHref} aria-current={window.location.pathname === catalogHref ? 'page' : undefined}>{t("All tools")}</a>
          <details className="folio-tools">
            <summary>{t("Categories")}</summary>
            <div className="folio-categories">
              {CATEGORIES.map(category => (
                <section key={category.id} aria-labelledby={`nav-${category.id}`}>
                  <h2 id={`nav-${category.id}`}>{t(category.title)}</h2>
                  <a href={publicHref(hubPath(hubForTool(TOOLS.find(t => t.category === category.id)!)))} hrefLang="en">{locale === 'de' ? `${t('Explore all PDF tools')}: ${t(category.title)} (Englisch)` : `Explore ${category.title} tools`}</a>
                  {TOOLS.filter(tool => tool.implemented && tool.category === category.id).map(tool => (
                    <a key={tool.id} href={toolHref(tool.route)} hrefLang={locale === 'de' && hasGermanPage(tool.route) ? 'de' : 'en'} aria-current={window.location.pathname.replace(/\/$/, '') === toolHref(tool.route).replace(/\/$/, '') ? 'page' : undefined}>{locale === 'de' && !hasGermanPage(tool.route) ? englishFallback(tool.title) : t(tool.title)}</a>
                  ))}
                </section>
              ))}
            </div>
          </details>
          <a href={`${SITE_BASE}guides/`} hrefLang="en" aria-current={window.location.pathname.replace(/\/$/, '') === `${SITE_BASE}guides` ? 'page' : undefined}>{englishFallback("Guides")}</a>
          <a href={`${SITE_BASE}help/`} hrefLang="en">{englishFallback("Help")}</a>
          <a href={`${SITE_BASE}privacy/`} hrefLang="en">{englishFallback("Privacy")}</a>
        </nav>
        <label className="folio-language">
          <span className="visually-hidden">{t('Language')}</span>
          <select value={locale} aria-label={t('Language')} onChange={event => {
            const next = event.target.value as 'en' | 'de'
            if (!switchPageLocale(next)) setLocale(next)
          }}>
            <option value="en">EN</option><option value="de">DE</option>
          </select>
        </label>
      </div>
      <p className="folio-trust"><strong>{t("Free forever · Open source")}</strong><span>{t("PDF processing on your device. No account required.")}</span></p>
    </header>
  )
}
