'use strict'

// Isolate Tropy's internal store conventions in one replaceable adapter.
// No database writes, source patches, schema changes or editor monkey-patching.
class TropyAdapter {
  constructor(context) { this.window = context.window }
  get store() { return this.window?.store }
  locale() {
    return this.store?.getState?.()?.intl?.locale || this.window?.args?.locale || 'en'
  }
  state() {
    const state = this.store?.getState?.()
    if (!state?.nav || !state.notes || !state.items || !state.photos || !state.selections) return null
    return state
  }
  itemId() {
    const state = this.state()
    return state?.nav.items?.length === 1 ? state.nav.items[0] : null
  }
  notes() {
    const state = this.state()
    const item = state?.items[this.itemId()]
    if (!item || item.deleted) return []
    const result = []
    const seen = new Set()
    const add = (parent, photo, photoNumber, selection = null) => {
      if (!parent || parent.deleted) return
      for (const [index, id] of (parent.notes || []).entries()) {
        const note = state.notes[id]
        if (!note || note.deleted || seen.has(id)) continue
        seen.add(id)
        result.push({
          id, item: item.id, photo: photo.id, selection,
          photoNumber, noteNumber: index + 1,
          doc: note.state?.doc
        })
      }
    }
    for (const [index, id] of (item.photos || []).entries()) {
      const photo = state.photos[id]
      if (!photo || photo.deleted) continue
      add(photo, photo, index + 1)
      for (const selection of photo.selections || []) {
        add(state.selections[selection], photo, index + 1, selection)
      }
    }
    return result
  }
  select(note) {
    // This is the same navigation action dispatched by Tropy's note list.
    // It also switches the photo and expands the associated selection, if any.
    if (this.itemId() !== note.item || !this.notes().some(n => n.id === note.id)) return false
    this.store.dispatch({
      type: 'note.select',
      payload: { item: note.item, photo: note.photo, selection: note.selection, note: note.id },
      meta: { log: 'trace' }
    })
    return true
  }
}
module.exports = TropyAdapter
