import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { CATEGORIES, TOOLS, QUOTAS } from '../src/registry'

// Empty catalog only. No document inputs, captured document images or external requests.
test('task discovery combines search and categories, announces results and retains focus', async ({ page }) => {
  await page.goto('./')
  const catalog=page.getByRole('region',{name:'Tool catalog'}),search=catalog.getByRole('searchbox',{name:'Search tools'})
  const status=catalog.getByRole('status'),categories=catalog.getByRole('group',{name:'Filter by category'})
  await expect(status).toHaveText(`${TOOLS.length} tools in your toolbox · ${TOOLS.filter(t=>t.implemented).length} ready to use`)
  for (const [query,name] of [['join documents','Merge PDF'],['properties','Document information'],['photos','JPG/PNG to PDF'],['plain text','PDF to text']]) {
    await search.fill(query)
    await expect(catalog.getByRole('link',{name:`Open ${name}`,exact:true})).toBeVisible()
    await expect(search).toBeFocused()
  }
  await search.fill('pdf')
  const convert=categories.getByRole('button',{name:'Convert to PDF',exact:true})
  await convert.focus();await convert.press('Space')
  await expect(convert).toHaveAttribute('aria-pressed','true');await expect(convert).toBeFocused()
  await expect(status).toHaveText('1 tool found · 1 ready to use')
  await expect(catalog.locator('.tool-card')).toHaveCount(1)
  await catalog.getByRole('button',{name:'Clear search',exact:true}).click()
  await expect(search).toHaveValue('');await expect(search).toBeFocused()
  await expect(convert).toHaveAttribute('aria-pressed','true')
  await search.fill('unavailable-test <script>')
  await expect(catalog.getByRole('heading',{name:'No matching tools'})).toBeVisible()
  await expect(status).toHaveText('0 tools found · 0 ready to use')
  await expect(catalog.locator('script')).toHaveCount(0)
  await expect(catalog.getByText(/in Convert to PDF/)).toBeVisible()
  await catalog.getByRole('button',{name:'Reset filters',exact:true}).click()
  await expect(search).toBeFocused();await expect(search).toHaveValue('')
  await expect(catalog.locator('.tool-card')).toHaveCount(TOOLS.length)
  await expect(categories.getByRole('button',{name:'All tools',exact:true})).toHaveAttribute('aria-pressed','true')
  await search.fill('rotate');await search.press('Escape');await expect(search).toHaveValue('')
  await page.getByRole('heading',{name:'Find the right PDF tool'}).click();await page.keyboard.press('/')
  await expect(search).toBeFocused()
  expect(new URL(page.url()).search).toBe('');expect(await page.title()).not.toContain('unavailable-test')
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0})
})

test('discovery is readable and usable in both themes, narrow layouts and zoom-equivalent width', async ({ page }, info) => {
  await page.goto('./')
  const catalog=page.getByRole('region',{name:'Tool catalog'})
  for(const width of [320,390,640,768,1440]) {
    await page.setViewportSize({width,height:900})
    for(const colorScheme of ['light','dark'] as const) {
      await page.emulateMedia({colorScheme})
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      const clipped=await catalog.locator('a,button,input').evaluateAll(elements=>elements.filter(el=>{
        if ((el as HTMLButtonElement).disabled) return false
        const r=el.getBoundingClientRect();return r.width<44||r.height<44||r.left<0||r.right>innerWidth+1
      }).map(el=>el.textContent||el.getAttribute('aria-label')))
      expect(clipped).toEqual([])
      // Dedicated empty-catalog captures only; never use this variable in document tests.
      if (process.env.PDF_TOOLS_CATALOG_VISUAL_DIR && [320,1440].includes(width)) {
        await mkdir(process.env.PDF_TOOLS_CATALOG_VISUAL_DIR,{recursive:true})
        await catalog.screenshot({path:join(process.env.PDF_TOOLS_CATALOG_VISUAL_DIR,`catalog-${info.project.name}-${width}-${colorScheme}.png`),animations:'disabled'})
      }
      // Relative luminance verifies actual computed text/surface colors, including dark mode.
      expect(await catalog.locator('.tool-desc').first().evaluate(el=>{
        const luminance=(color:string)=>{const values=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return values[0]*.2126+values[1]*.7152+values[2]*.0722}
        const fg=luminance(getComputedStyle(el).color),bg=luminance(getComputedStyle(el.closest('.tool-card')!).backgroundColor)
        return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)
      })).toBeGreaterThanOrEqual(4.5)
    }
  }
  for(const category of CATEGORIES) {
    const button=catalog.getByRole('button',{name:category.title,exact:true});await button.click()
    await expect(catalog.locator('.tool-card')).toHaveCount(TOOLS.filter(t=>t.category===category.id).length)
  }
  await expect(catalog.getByText(`Files up to ${QUOTAS.maxInputBytes/(1024*1024)} MiB each.`,{exact:false})).toBeVisible()
  await page.emulateMedia({reducedMotion:'reduce'})
  expect(await catalog.locator('.tool-card').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s')
})

test('all enabled result cards lead to working tool routes',async({page})=>{
  for(const tool of TOOLS.filter(t=>t.implemented)) {
    await page.goto('./')
    const catalog=page.getByRole('region',{name:'Tool catalog'})
    await catalog.getByRole('searchbox',{name:'Search tools'}).fill(tool.title)
    await catalog.getByRole('link',{name:`Open ${tool.title}`,exact:true}).click()
    await expect(page).toHaveURL(new RegExp(`/pdf-tools${tool.route}/?$`))
    await expect(page.locator('input[type=file]')).toHaveCount(1)
  }
})
