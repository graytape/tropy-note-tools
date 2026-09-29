'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { element, button } = require('./dom')
const { translator, normalize } = require('./i18n')
const { compile, findRanges, findInNotes, documentRuns, domRuns } = require('./matches')

class Search {
  constructor(doc, adapter, logger) {
    this.doc = doc
    this.adapter = adapter
    this.logger = logger
    this.open = false
    this.results = []
    this.active = -1
    this.limit = 100
    this.pending = null
    this.style = element(doc, 'style')
    this.style.textContent = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8')
    doc.head.append(this.style)
    this.i18n = translator(this.adapter.locale())
    this.build()
    this.localize()
    this.key = event => this.onKey(event)
    this.doc.addEventListener('keydown', this.key, true)
    this.timer = setInterval(() => this.scan(), 250)
    this.scan()
  }

  build() {
    const d = this.doc
    this.bar = element(d, 'div', { class: 'nt-toolbar', role: 'group', hidden: '' })
    this.panel = element(d, 'div', { class: 'nt-panel', hidden: '' })
    const row = element(d, 'div', { class: 'nt-search' })
    this.input = element(d, 'input', { type: 'search', placeholder: '' })
    this.count = element(d, 'output', { 'aria-live': 'polite' })
    this.matchCase = false
    this.useRegex = false
    const toggle = (node, field) => {
      this[field] = !this[field]
      node.setAttribute('aria-pressed', String(this[field]))
      this.pending = null; this.active = -1; this.limit = 100; this.rebuild()
    }
    this.exact = button(d, '', 'Aa', () => toggle(this.exact, 'matchCase'))
    this.regex = button(d, '', '.*', () => toggle(this.regex, 'useRegex'))
    for (const node of [this.exact, this.regex]) {
      node.className = 'nt-toggle'
      node.setAttribute('aria-pressed', 'false')
    }
    this.previous = button(d, '', '↑', () => this.move(-1))
    this.next = button(d, '', '↓', () => this.move(1))
    this.closeButton = button(d, '', '×', () => this.close())
    row.append(this.input, this.count, this.exact, this.regex, this.previous, this.next, this.closeButton)
    this.status = element(d, 'div', { class: 'nt-status', role: 'status' })
    this.list = element(d, 'div', { class: 'nt-results', role: 'group' })
    this.more = button(d, '', '', () => { this.limit += 100; this.render() })
    this.panel.append(row, this.status, this.list, this.more)
    this.bar.append(this.panel)
    this.input.addEventListener('input', () => {
      this.pending = null; this.active = -1; this.limit = 100; this.rebuild()
    })
  }

  scan() {
    if (this.disposed) return
    const store = this.adapter.store
    if (store !== this.store) {
      this.unsubscribe?.()
      this.store = store
      this.unsubscribe = store?.subscribe?.(() => {
        clearTimeout(this.debounce)
        this.debounce = setTimeout(() => this.update(), 60)
      })
    }
    const frame = this.doc.querySelector('.note-pad .editor iframe.prosemirror')
    let root
    try {
      const inner = frame?.contentDocument
      // Locale changes can leave an iframe document alive after its Window dies.
      if (inner?.defaultView && !inner.defaultView.closed)
        root = inner.querySelector('.ProseMirror')
    } catch { /* Inaccessible frames are ignored. */ }
    if (root !== this.root) {
      this.detach()
      if (root) {
        this.root = root
        this.frame = frame
        frame.before(this.bar)
        this.inner = root.ownerDocument
        this.inner.addEventListener('keydown', this.key, true)
        this.highlightStyle = element(this.inner, 'style')
        this.highlightStyle.textContent = '::highlight(nt-all){background:#f4d35e;color:#171717}::highlight(nt-active){background:#f28c28;color:#111}'
        this.inner.head.append(this.highlightStyle)
        this.observer = new this.inner.defaultView.MutationObserver(() => {
          if (this.open && !this.adapter.state()) this.rebuild()
          else this.paint()
        })
        this.observer.observe(root, { childList: true, subtree: true, characterData: true })
        this.paint()
      }
    }
    if (this.root) {
      if (!this.highlightStyle.isConnected) this.inner.head.append(this.highlightStyle)
      const css = this.inner.defaultView.getComputedStyle(this.inner.body)
      this.bar.style.color = css.color
      if (css.backgroundColor !== 'rgba(0, 0, 0, 0)') this.bar.style.backgroundColor = css.backgroundColor
    }
    this.update()
    if (this.pending) this.paint()
  }

  supported() { return !!(this.inner?.defaultView?.CSS?.highlights && this.inner?.defaultView?.Highlight) }

  localize() {
    this.i18n = translator(this.adapter.locale())
    const { t } = this.i18n
    this.bar.lang = this.i18n.language
    this.bar.setAttribute('aria-label', t('title'))
    this.input.placeholder = t('placeholder')
    this.input.setAttribute('aria-label', t('placeholder'))
    this.exact.setAttribute('aria-label', t('matchCase'))
    this.exact.title = t('matchCase')
    this.regex.title = t('regex')
    this.regex.setAttribute('aria-label', t('regex'))
    this.list.setAttribute('aria-label', t('results'))
    for (const [node, key] of [[this.previous, 'previous'], [this.next, 'next'], [this.closeButton, 'close'], [this.more, 'moreLabel']]) {
      node.title = t(key)
      node.setAttribute('aria-label', t(key))
    }
    this.more.textContent = t('more')
    if (this.open) this.render()
  }

  update() {
    if (this.disposed) return
    if (normalize(this.adapter.locale()) !== this.i18n.language) this.localize()
    if (!this.open) return
    const state = this.adapter.state()
    const item = this.adapter.itemId()
    if (item !== this.item) {
      this.item = item
      this.active = -1
      this.pending = null
    }
    if (state?.notes !== this.notesRef || state?.items !== this.itemsRef || state?.photos !== this.photosRef || state?.selections !== this.selectionsRef || item !== this.indexedItem) {
      this.notesRef = state?.notes; this.itemsRef = state?.items
      this.photosRef = state?.photos; this.selectionsRef = state?.selections
      this.indexedItem = item
      this.rebuild()
    }
    // Manual navigation cancels any pending automatic scroll to an older result.
    if (this.pending && state?.nav.note !== this.pending.note.id) this.pending = null
    if (this.currentNote !== state?.nav.note) {
      this.currentNote = state?.nav.note
      this.paint()
    }
  }

  show() {
    if (this.disposed || !this.root || !this.inner?.defaultView) return
    this.localize()
    const wasOpen = this.open
    this.open = true
    this.bar.hidden = false
    this.panel.hidden = false
    this.item = this.adapter.itemId()
    if (!wasOpen) {
      const selection = this.inner.defaultView.getSelection()
      if (selection?.rangeCount && this.root.contains(selection.anchorNode) && selection.toString()) this.input.value = selection.toString()
    }
    this.rebuild()
    this.input.focus()
    this.input.select()
  }

  rebuild() {
    this.patternError = false
    try { compile(this.input.value, this.matchCase, this.useRegex) } catch {
      this.patternError = true
    }
    this.input.setAttribute('aria-invalid', String(this.patternError))
    if (this.patternError) {
      this.results = []; this.active = -1; this.pending = null
      this.clearHighlights(); this.render()
      return
    }
    const previous = this.results[this.active]
    if (this.adapter.state()) {
      this.results = findInNotes(this.adapter.notes(), this.input.value, this.matchCase, this.useRegex)
    } else {
      // A visible fallback remains usable if a future Tropy removes its store API.
      const ranges = this.root ? findRanges(this.root, this.input.value, this.matchCase, this.useRegex) : []
      this.results = ranges.map((range, ordinal) => ({ note: { id: null }, ordinal, before: '', hit: range.toString(), after: '' }))
    }
    this.active = previous ? this.results.findIndex(r => r.note.id === previous.note.id && r.ordinal === previous.ordinal) : -1
    if (this.pending) {
      // Re-indexing may run before React finishes rendering the destination.
      // Rebind the pending target instead of keeping an obsolete result object.
      const pending = this.pending
      this.pending = this.results.find(r => r.note.id === pending.note.id && r.ordinal === pending.ordinal) || null
    }
    this.render()
    this.paint()
  }

  render() {
    const total = this.results.length
    this.count.textContent = `${this.active + 1}/${total}`
    this.previous.disabled = this.next.disabled = !total || !this.supported()
    const n = new Set(this.results.map(r => r.note.id)).size
    const { t } = this.i18n
    this.status.textContent = this.patternError ? t('invalidRegex') : !this.supported() ? t('unsupported')
      : !this.adapter.state() ? t('fallback')
      : this.adapter.itemId() === null ? t('chooseItem')
      : !this.input.value ? '' : this.i18n.summary(total, n)
    this.status.hidden = !this.status.textContent
    this.limit = Math.max(this.limit, this.active + 1)
    this.list.replaceChildren()
    this.results.slice(0, this.limit).forEach((result, index) => {
      const noteLabel = this.i18n.noteLabel(result.note)
      const control = button(this.doc, `${noteLabel}: ${result.hit}`, '', () => this.activate(index))
      control.className = 'nt-result'
      control.setAttribute('aria-current', String(index === this.active))
      const title = element(this.doc, 'span', { class: 'nt-result-label' }, noteLabel)
      const snippet = element(this.doc, 'span', { class: 'nt-snippet', dir: 'auto' })
      snippet.append(this.doc.createTextNode(result.before), element(this.doc, 'mark', {}, result.hit), this.doc.createTextNode(result.after))
      control.append(title, snippet)
      this.list.append(control)
    })
    this.more.hidden = total <= this.limit
    if (this.active >= 0) this.list.children[this.active]?.scrollIntoView?.({ block: 'nearest' })
  }

  activate(index) {
    const result = this.results[index]
    if (!result) return
    this.active = index
    this.pending = result
    this.deadline = Date.now() + 3000
    if (result.note.id !== null && !this.adapter.select(result.note)) {
      this.pending = null
      this.rebuild()
      return
    }
    this.render()
    // The Redux action is synchronous; React's editor update may come later.
    this.paint()
  }

  move(delta) {
    if (!this.results.length) return
    this.activate(this.active < 0 ? (delta > 0 ? 0 : this.results.length - 1) : (this.active + delta + this.results.length) % this.results.length)
  }

  paint() {
    if (!this.root || !this.supported()) return
    const win = this.inner.defaultView
    if (!this.open || this.patternError) { this.clearHighlights(); return }
    const state = this.adapter.state()
    const noteId = state?.nav.note ?? null
    // Do not paint old DOM between the navigation action and React's render.
    if (state) {
      const expected = documentRuns(state.notes[noteId]?.state?.doc).filter(Boolean)
      const actual = domRuns(this.root).map(r => r.text).filter(Boolean)
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        this.clearHighlights()
        if (this.pending && Date.now() > this.deadline) {
          this.pending = null
          this.status.textContent = this.i18n.t('timeout')
        }
        return
      }
    }
    const ranges = findRanges(this.root, this.input.value, this.matchCase, this.useRegex)
    const all = new win.Highlight()
    ranges.forEach(range => all.add(range))
    const active = new win.Highlight()
    active.priority = 1
    const target = this.results[this.active]
    const range = target?.note.id === noteId ? ranges[target.ordinal] : null
    if (range) active.add(range)
    win.CSS.highlights.set('nt-all', all)
    win.CSS.highlights.set('nt-active', active)
    if (this.pending && this.pending === target && range) {
      const rect = range.getBoundingClientRect()
      if (rect.top < 0 || rect.bottom > win.innerHeight || rect.left < 0 || rect.right > win.innerWidth) {
        win.scrollBy({ top: rect.top - win.innerHeight / 2, left: rect.left - win.innerWidth / 2, behavior: 'auto' })
      }
      this.pending = null
    }
  }

  onKey(event) {
    const inEditor = event.target?.ownerDocument === this.inner
    const inBar = this.bar.contains(event.target)
    if (!inEditor && !inBar) return
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
      event.preventDefault(); event.stopImmediatePropagation(); this.show()
    } else if (this.open && (event.key === 'Escape' || (event.target === this.input && event.key === 'Enter'))) {
      event.preventDefault(); event.stopImmediatePropagation()
      if (event.key === 'Escape') this.close()
      else this.move(event.shiftKey ? -1 : 1)
    }
  }

  close() {
    this.open = false
    this.pending = null
    this.panel.hidden = true
    this.bar.hidden = true
    this.clearHighlights()
    this.root?.focus()
  }
  clearHighlights() {
    this.inner?.defaultView?.CSS?.highlights?.delete('nt-all')
    this.inner?.defaultView?.CSS?.highlights?.delete('nt-active')
  }
  detach() {
    // Cleanup must remain safe even after the iframe Window has been destroyed.
    this.observer?.disconnect()
    this.inner?.removeEventListener('keydown', this.key, true)
    this.clearHighlights()
    this.highlightStyle?.remove()
    this.bar.remove()
    this.root = this.inner = this.frame = null
    this.observer = this.highlightStyle = null
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    clearInterval(this.timer)
    clearTimeout(this.debounce)
    this.unsubscribe?.()
    this.doc.removeEventListener('keydown', this.key, true)
    this.detach()
    this.style.remove()
  }
}
module.exports = Search
