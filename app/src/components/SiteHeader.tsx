import { useLocale } from '../i18n'
import { hubForTool, hubPath, publicHref } from '../lib/categoryHubs'
import { useEffect, useRef, useState } from 'react'
import { SITE_BASE } from '../lib/seo'
import { CATEGORIES, TOOLS } from '../registry'
import { href } from '../router'
import './SiteHeader.css'

const SOURCE = 'https://github.com/Akshat4112/pdf-tools'

/** Shared navigation never holds document or job state. */
export function SiteHeader() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const { locale, setLocale } = useLocale()
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
        <a className="folio-home" href={SITE_BASE} aria-label={t("PDF Tools home")} onClick={() => {
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
          {open ? 'Close' : 'Menu'} <span aria-hidden="true">{open ? '×' : '☰'}</span>
        </button>
        <nav id="folio-navigation" className={`folio-navigation${open ? ' is-open' : ''}`} aria-label={t("Main navigation")}
          onClick={event => {
            if ((event.target as HTMLElement).closest('a')) {
              setOpen(false)
              root.current?.querySelectorAll('details[open]').forEach(detail => detail.removeAttribute('open'))
            }
          }}>
          <a href={SITE_BASE} aria-current={window.location.pathname === SITE_BASE ? 'page' : undefined}>{t("All tools")}</a>
          <details className="folio-tools">
            <summary>{t("Categories")}</summary>
            <div className="folio-categories">
              {CATEGORIES.map(category => (
                <section key={category.id} aria-labelledby={`nav-${category.id}`}>
                  <h2 id={`nav-${category.id}`}>{t(category.title)}</h2>
                  <a href={publicHref(hubPath(hubForTool(TOOLS.find(t => t.category === category.id)!)))}>{locale === 'de' ? `${t('Explore all PDF tools')}: ${t(category.title)}` : `Explore ${category.title} tools`}</a>
                  {TOOLS.filter(tool => tool.implemented && tool.category === category.id).map(tool => (
                    <a key={tool.id} href={href(tool.route)} aria-current={window.location.pathname.replace(/\/$/, '') === href(tool.route) ? 'page' : undefined}>{t(tool.title)}</a>
                  ))}
                </section>
              ))}
            </div>
          </details>
          <a href={`${SITE_BASE}guides/`} aria-current={window.location.pathname.replace(/\/$/, '') === `${SITE_BASE}guides` ? 'page' : undefined}>{t("Guides")}</a>
          <a href={`${SOURCE}/blob/main/docs/product/PT-PD-003-data-lifecycle.md`}>{t("Privacy")} <span>↗<span className="visually-hidden"> (on GitHub)</span></span></a>
          <a href={SOURCE}>{t("Source")} <span>↗<span className="visually-hidden"> (on GitHub)</span></span></a>
        </nav>
        <label className="folio-language">
          <span className="visually-hidden">{t('Language')}</span>
          <select value={locale} aria-label={t('Language')} onChange={event => setLocale(event.target.value as 'en' | 'de')}>
            <option value="en">EN</option><option value="de">DE</option>
          </select>
        </label>
      </div>
      <p className="folio-trust"><strong>{t("Free forever · Open source")}</strong><span>{t("PDF processing on your device. No account required.")}</span></p>
    </header>
  )
}
