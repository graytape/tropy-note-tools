'use strict'
const TropyAdapter = require('./lib/tropy')
const Search = require('./lib/search')
const INSTANCE = Symbol.for('tropy.note-tools.instance.v1')

// Keep search state outside individual iframes so it survives note/photo changes.
class NoteTools {
  constructor(_options = {}, context = {}) {
    this.doc = typeof document === 'object' ? document : null
    if (!this.doc) return
    this.doc[INSTANCE]?.unload()
    this.doc[INSTANCE] = this
    this.adapter = new TropyAdapter(context)
    this.search = new Search(this.doc, this.adapter, context.logger || console)
  }
  unload() {
    this.search?.dispose()
    if (this.doc?.[INSTANCE] === this) delete this.doc[INSTANCE]
  }
}
module.exports = NoteTools
