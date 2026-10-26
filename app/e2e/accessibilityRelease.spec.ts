import { test, expect } from '@playwright/test'

/**
 * PT-UI-007 browser accessibility regression: authored UI chrome and empty
 * workspaces only. This is NOT a screen-reader session, a physical device
 * audit or a certification against the whole WCAG 2.2 standard.
 */
test('keyboard skip navigation targets exactly one main landmark across published routes', async ({ page }) => {
  for (const path of ['./','merge/','guides/','help/','trust/','unrecognized-a11y-route']) {
    await page.goto(path)
    const main = page.getByRole('main')
    await expect(main).toHaveCount(1)
    await expect(main).toHaveAttribute('id','main-content')
    await expect(main).toHaveAttribute('tabindex','-1')
    await expect(main.getByRole('heading',{level:1})).toHaveCount(1)
    await page.keyboard.press('Tab')
    const skip=page.getByRole('link',{name:'Skip to main content'})
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await skip.press('Enter')
    await expect(main).toBeFocused()
  }
  await page.goto('./')
  await page.locator('select[aria-label="Language"]').selectOption('de')
  await expect(page.getByRole('link',{name:'Zum Hauptinhalt springen'})).toHaveCount(1)
  await expect(page.getByRole('link',{name:'Skip to main content'})).toHaveCount(0)
})

test('responsive site landmarks, navigation and focus controls meet measurable mobile bounds', async ({page})=>{
  test.setTimeout(120000)
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900})
    for(const colorScheme of ['light','dark'] as const) {
      await page.emulateMedia({colorScheme,reducedMotion:'reduce'})
      for (const path of ['./','merge/','help/']) {
        await page.goto(path)
        await expect(page.getByRole('banner')).toHaveCount(1)
        await expect(page.getByRole('contentinfo')).toHaveCount(1)
        await expect(page.getByRole('main')).toHaveCount(1)
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1), `${path} ${width}px ${colorScheme}`).toBe(true)
        const invalid=await page.locator('.folio-header a,.folio-header button,.folio-header summary,.fl-site-footer a').evaluateAll(items=>items.filter(item=>{
          const el=item as HTMLElement,rect=el.getBoundingClientRect(),style=getComputedStyle(el)
          if(style.display==='none'||!rect.width||!rect.height)return false
          return rect.width < 44 || rect.height < 44 || rect.left < -1 || rect.right > innerWidth+1
        }).map(item=>item.getAttribute('href')||item.textContent?.trim().slice(0,45)))
        expect(invalid, `${path} ${width}px ${colorScheme}`).toEqual([])
      }
    }
  }
})

test('text contrast: shared header/footer and home disclosures meet WCAG AA 4.5:1',async({page})=>{
  for(const scheme of ['light','dark'] as const) {
    await page.emulateMedia({colorScheme:scheme})
    await page.goto('./')
    const contrast=await page.locator('.folio-trust,.fl-footer-identity p,.fl-footer-group a,.fl-footer-bottom p,.fl-home .fl-fine-print').evaluateAll(items=>{
      const luminance=(rgb:string)=>{
        const values=(rgb.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4})
        return values[0]*.2126+values[1]*.7152+values[2]*.0722
      }
      const opaqueBackground=(el:Element)=>{
        let parent:Element|null=el
        while(parent){
          const bg=getComputedStyle(parent).backgroundColor
          if(bg.startsWith('rgb(')||/rgba\([^)]*,\s*1\s*\)/.test(bg))return bg
          parent=parent.parentElement
        }
        return 'rgb(255,255,255)'
      }
      return items.map(el=>{
        const c=getComputedStyle(el),a=luminance(c.color),b=luminance(opaqueBackground(el))
        return {text:el.textContent?.trim().slice(0,45),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
      })
    })
    for(const sample of contrast)expect(sample.ratio,`${scheme}: ${sample.text}`).toBeGreaterThanOrEqual(4.5)
  }
})

test('reflow near effective 200% zoom keeps primary journeys operable',async({page})=>{
  await page.setViewportSize({width:640,height:900})
  await page.goto('./')
  // CSS zoom approximates reflow only; manual native 200% zoom remains open.
  await page.evaluate(()=>{document.documentElement.style.zoom='2'})
  await expect(page.getByRole('searchbox',{name:'Search tools'})).toBeVisible()
  await expect(page.getByRole('link',{name:'View trust evidence'})).toBeVisible()
  await page.getByRole('searchbox',{name:'Search tools'}).fill('merge')
  await expect(page.getByRole('link',{name:'Open Merge PDF',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true)
  await page.locator('.fl-quick-card',{hasText:'Merge PDF'}).first().click()
  await expect(page.getByRole('main').getByRole('heading',{level:1,name:'Merge PDF'})).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveCount(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true)
})

test('static no-JS content retains skip target and navigation',async({browser,request})=>{
  for(const path of ['help/','trust/','merge/']){
    const response=await request.get(path);expect(response.ok()).toBe(true)
    const body=await response.text()
    expect(body).toContain('href="#main-content"')
    expect(body).toContain('<noscript><main id="main-content" tabindex="-1"')
  }
  const context=await browser.newContext({javaScriptEnabled:false})
  try {
    const page=await context.newPage()
    await page.goto('http://127.0.0.1:4178/pdf-tools/help/')
    // no-JS keyboard navigation should still reach the static article
    await page.keyboard.press('Tab')
    const link=page.getByRole('link',{name:'Skip to main content'})
    await expect(link).toBeFocused()
    await link.press('Enter')
    await expect(page.locator('noscript main#main-content')).toBeFocused()
  } finally {await context.close()}
})
