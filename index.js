'use strict'
const TropyAdapter = require('./lib/tropy')
const Search = require('./lib/search')
const { translator } = require('./lib/i18n')
const INSTANCE = Symbol.for('tropy.note-tools.instance.v1')

// Keep search state outside individual iframes so it survives note/photo changes.
class NoteTools {
  constructor(options = {}, context = {}) {
    this.doc = typeof document === 'object' ? document : null
    if (!this.doc) return
    this.doc[INSTANCE]?.unload()
    this.doc[INSTANCE] = this
    this.adapter = new TropyAdapter(context)
    this.host = context.window
    this.localizeMetadata = (settings = {}) => {
      const plugins = this.host?.plugins
      const spec = plugins?.spec?.['tropy-note-tools']
      if (!spec) return
      const { t } = translator(settings.locale || this.adapter.locale())
      // Tropy renders plugin option labels as literal strings, not message IDs.
      plugins.spec['tropy-note-tools'] = {
        ...spec, description: t('description'),
        options: spec.options.map(option => option.field === 'enabled' ? { ...option, label: t('enable') } : option)
      }
      plugins.emit?.('change')
    }
    this.localizeMetadata()
    this.host?.on?.('settings.update', this.localizeMetadata)
    if (options.enabled === false) return
    this.search = new Search(this.doc, this.adapter, context.logger || console)
  }
  unload() {
    this.search?.dispose()
    this.host?.removeListener?.('settings.update', this.localizeMetadata)
    if (this.doc?.[INSTANCE] === this) delete this.doc[INSTANCE]
  }
}
module.exports = NoteTools
