import { test, expect } from '@playwright/test'

/** PT-UI-003: public links, empty tool workspaces and synthetic/no-file pages only. */
test('shared branded footer is present once on every public route and the 404', async ({ page, request }) => {
  for (const path of ['./','merge/','split/','tools/convert/','guides/','help/','privacy/','limitations/','trust/','nonexistent-footer-test']) {
    await page.goto(path)
    const footer = page.getByRole('contentinfo')
    await expect(footer).toHaveCount(1)
    await expect(footer.getByRole('link', { name: 'PDF Tools', exact: true })).toHaveAttribute('href','/pdf-tools/')
    await expect(footer.getByRole('link',{name:'Privacy notice'})).toHaveAttribute('href','/pdf-tools/privacy/')
    await expect(footer.getByRole('link',{name:'About and trust evidence'})).toHaveAttribute('href','/pdf-tools/trust/')
    await expect(footer.getByRole('link',{name:'MIT license'})).toHaveAttribute('href',/\/blob\/main\/LICENSE$/)
    await expect(footer).toContainText('Do not share confidential PDFs')
  }
  // The footer is embedded in every statically emitted public HTML page.
  for(const path of ['help/','trust/','merge/']) {
    const response=await request.get(path)
    expect(response.ok()).toBe(true)
    const html=await response.text()
    expect(html).toContain('class="fl-site-footer"')
    expect(html).toContain('href="/pdf-tools/privacy/"')
  }
})

test('footer references only shipped internal pages and repository resources', async ({ request, page }) => {
  await page.goto('./')
  const footer=page.getByRole('contentinfo')
  const links=await footer.locator('a[href]').evaluateAll(items=>items.map(item=>({url:(item as HTMLAnchorElement).getAttribute('href')!,text:item.textContent!})))
  for(const {url} of links) {
    if(url.startsWith('/pdf-tools/')) {
      expect((await request.get(url)).ok()).toBe(true)
    } else {
      expect(url).toMatch(/^https:\/\/github\.com\/Akshat4112\/pdf-tools(?:\/|$)/)
    }
  }
  expect(links.map(x=>x.url)).toContain('https://github.com/Akshat4112/pdf-tools/blob/main/docs/operations/PT-OPS-001-pr-task-workflow.md')
  expect(links.map(x=>x.url)).toContain('https://github.com/Akshat4112/pdf-tools/issues/new')
  const security=footer.locator('a[href="https://github.com/Akshat4112/pdf-tools/security"]')
  await expect(security).toHaveAttribute('rel',/noopener/)
})

test('footer reflows, follows locale switching and remains keyboard-accessible', async ({ page }) => {
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900})
    for(const colorScheme of ['light','dark'] as const) {
      await page.emulateMedia({colorScheme,reducedMotion:'reduce'})
      await page.goto('merge/')
      const footer=page.getByRole('contentinfo')
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const broken=await footer.locator('a').evaluateAll(elements=>elements.filter(el=>{
        const box=el.getBoundingClientRect()
        return box.width < 44 || box.height < 44 || box.left < 0 || box.right > innerWidth+1
      }).map(el=>el.textContent))
      expect(broken).toEqual([])
      const privacy=footer.getByRole('link',{name:'Privacy notice'})
      await privacy.focus()
      await expect(privacy).toBeFocused()
      await privacy.press('Enter')
      await expect(page).toHaveURL(/\/pdf-tools\/privacy\/?$/)
      await page.goBack()
    }
  }
  await page.locator('select[aria-label="Language"]').selectOption('de')
  const footer=page.getByRole('contentinfo')
  await expect(footer.getByRole('link',{name:'Datenschutzhinweise'})).toBeVisible()
  await expect(footer.getByRole('link',{name:'Alle PDF-Tools'})).toBeVisible()
  await expect(footer).toContainText('Teile keine vertraulichen PDFs')
})

test('footer is accessible on static pages when JavaScript is disabled', async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false})
  try{
    const page=await context.newPage()
    for(const path of ['http://127.0.0.1:4178/pdf-tools/help/','http://127.0.0.1:4178/pdf-tools/trust/']){
      await page.goto(path)
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('contentinfo')).toBeVisible()
      await expect(page.getByRole('contentinfo').getByRole('link',{name:'Help and FAQ'})).toBeVisible()
    }
  } finally {await context.close()}
})
