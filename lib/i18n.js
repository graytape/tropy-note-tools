'use strict'

// Keep every user-facing string in one catalog. Regional locales use their base language.
const messages = {
  en: {
    regex: 'Use regular expressions', invalidRegex: 'Invalid regular expression. Check the pattern.',
    title: 'Find in item notes', placeholder: 'Find in all notes of this item',
    matchCase: 'Match case', previous: 'Previous result (Shift+Enter)', next: 'Next result (Enter)',
    close: 'Close (Escape)', results: 'Search results', more: 'Show more', moreLabel: 'Show more results',
    currentNote: 'Current note', fallback: 'Current note only: this Tropy version does not expose the item store.',
    chooseItem: 'Open one item to search its notes.',
    timeout: 'The editor has not finished opening the selected note. Click the result to retry.',
    unsupported: 'Search highlighting is unavailable in this Tropy version. Update Tropy to use this plugin.',
    photo: 'Photo', selection: 'Selection', note: 'Note', result: ['result', 'results'], notes: ['note', 'notes'],
    enable: 'Enable Note Tools', description: 'Search all notes of an item and automatically open the matching photo and note.'
  },
  it: {
    regex: 'Usa espressioni regolari', invalidRegex: 'Espressione regolare non valida. Controlla la sintassi.',
    title: 'Cerca nelle note dell’oggetto', placeholder: 'Cerca in tutte le note di questo oggetto',
    matchCase: 'Distingui maiuscole e minuscole', previous: 'Risultato precedente (Maiusc+Invio)', next: 'Risultato successivo (Invio)',
    close: 'Chiudi (Esc)', results: 'Risultati della ricerca', more: 'Mostra altri', moreLabel: 'Mostra altri risultati',
    currentNote: 'Nota corrente', fallback: 'Solo nota corrente: questa versione di Tropy non espone i dati dell’oggetto.',
    chooseItem: 'Apri un singolo oggetto per cercare nelle sue note.',
    timeout: 'L’editor non ha ancora aperto la nota selezionata. Clicca di nuovo sul risultato.',
    unsupported: 'L’evidenziazione dei risultati non è disponibile in questa versione di Tropy. Aggiorna Tropy per usare il plugin.',
    photo: 'Foto', selection: 'Selezione', note: 'Nota', result: ['risultato', 'risultati'], notes: ['nota', 'note'],
    enable: 'Attiva Note Tools', description: 'Cerca in tutte le note di un oggetto e apre automaticamente la foto e la nota corrispondenti.'
  },
  fr: {
    regex: 'Utiliser des expressions régulières', invalidRegex: 'Expression régulière non valide. Vérifiez la syntaxe.',
    title: 'Rechercher dans les notes de l’objet', placeholder: 'Rechercher dans toutes les notes de cet objet',
    matchCase: 'Respecter la casse', previous: 'Résultat précédent (Maj+Entrée)', next: 'Résultat suivant (Entrée)',
    close: 'Fermer (Échap)', results: 'Résultats de recherche', more: 'Afficher plus', moreLabel: 'Afficher plus de résultats',
    currentNote: 'Note actuelle', fallback: 'Note actuelle uniquement : cette version de Tropy ne donne pas accès aux données de l’objet.',
    chooseItem: 'Ouvrez un seul objet pour rechercher dans ses notes.',
    timeout: 'L’éditeur n’a pas encore ouvert la note sélectionnée. Cliquez à nouveau sur le résultat.',
    unsupported: 'Le surlignage des résultats n’est pas disponible dans cette version de Tropy. Mettez Tropy à jour pour utiliser ce plugin.',
    photo: 'Photo', selection: 'Sélection', note: 'Note', result: ['résultat', 'résultats'], notes: ['note', 'notes'],
    enable: 'Activer Note Tools', description: 'Recherche dans toutes les notes d’un objet et ouvre automatiquement la photo et la note correspondantes.'
  },
  es: {
    regex: 'Usar expresiones regulares', invalidRegex: 'Expresión regular no válida. Comprueba la sintaxis.',
    title: 'Buscar en las notas del objeto', placeholder: 'Buscar en todas las notas de este objeto',
    matchCase: 'Distinguir mayúsculas y minúsculas', previous: 'Resultado anterior (Mayús+Intro)', next: 'Resultado siguiente (Intro)',
    close: 'Cerrar (Esc)', results: 'Resultados de búsqueda', more: 'Mostrar más', moreLabel: 'Mostrar más resultados',
    currentNote: 'Nota actual', fallback: 'Solo la nota actual: esta versión de Tropy no permite acceder a los datos del objeto.',
    chooseItem: 'Abre un solo objeto para buscar en sus notas.',
    timeout: 'El editor todavía no ha abierto la nota seleccionada. Haz clic de nuevo en el resultado.',
    unsupported: 'El resaltado de resultados no está disponible en esta versión de Tropy. Actualiza Tropy para usar el plugin.',
    photo: 'Foto', selection: 'Selección', note: 'Nota', result: ['resultado', 'resultados'], notes: ['nota', 'notas'],
    enable: 'Activar Note Tools', description: 'Busca en todas las notas de un objeto y abre automáticamente la foto y la nota correspondientes.'
  }
}
function normalize(locale) {
  const base = String(locale || 'en').toLowerCase().split(/[-_]/)[0]
  return messages[base] ? base : 'en'
}
function translator(locale) {
  const language = normalize(locale)
  const catalog = messages[language]
  const number = new Intl.NumberFormat(language)
  const plural = new Intl.PluralRules(language)
  return {
    language,
    t: key => catalog[key] ?? messages.en[key] ?? key,
    summary(count, notes) {
      const word = (key, n) => catalog[key][plural.select(n) === 'one' ? 0 : 1]
      return `${number.format(count)} ${word('result', count)} · ${number.format(notes)} ${word('notes', notes)}`
    },
    noteLabel(note) {
      if (note.id === null) return catalog.currentNote
      return `${catalog.photo} ${number.format(note.photoNumber)}${note.selection !== null ? ` · ${catalog.selection}` : ''} · ${catalog.note} ${number.format(note.noteNumber)}`
    }
  }
}
module.exports = { messages, normalize, translator }
