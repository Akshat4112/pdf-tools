// Reference-only interactions; no file reads, engine work, storage or network calls.
const themeToggle = document.querySelector('#theme-toggle')
function setTheme(dark) {
  document.body.dataset.flTheme = dark ? 'dark' : 'light'
  themeToggle.setAttribute('aria-pressed', String(dark))
}
setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
themeToggle.addEventListener('click', () => setTheme(document.body.dataset.flTheme !== 'dark'))
const pages = [...document.querySelectorAll('#selection-example button')]
function announceSelection() {
  let count = 0
  for (const page of pages) {
    const selected = page.getAttribute('aria-pressed') === 'true'
    page.querySelector('.selection-label').textContent = selected ? 'Selected' : 'Not selected'
    if (selected) count += 1
  }
  document.querySelector('#selection-status').textContent = `${count} example ${count === 1 ? 'page' : 'pages'} selected`
}
for (const page of pages) page.addEventListener('click', () => {
  page.setAttribute('aria-pressed', String(page.getAttribute('aria-pressed') !== 'true'))
  announceSelection()
})
document.querySelector('#sample-reset').addEventListener('click', () => {
  for (const page of pages) page.setAttribute('aria-pressed', 'false')
  announceSelection()
  pages[0].focus()
})
