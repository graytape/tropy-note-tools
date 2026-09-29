'use strict'

// Both modes use UTF-16 offsets, the same coordinate system as DOM Range.
function compile(query, matchCase = false, regex = false) {
  const source = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(source, matchCase ? 'gu' : 'giu')
}
function matches(text, query, matchCase = false, regex = false) {
  if (!query) return []
  return Array.from(text.matchAll(compile(query, matchCase, regex)))
    // Empty matches cannot be highlighted; matchAll advances them safely.
    .filter(match => match[0].length > 0)
    .map(match => ({ from: match.index, to: match.index + match[0].length }))
}

// Return paragraph-sized runs. Hard breaks terminate a run; inline marks do not.
function documentRuns(document) {
  if (document?.toJSON) document = document.toJSON()
  const runs = []
  function visit(node) {
    if (!node) return
    if (['paragraph', 'heading', 'code_block'].includes(node.type)) {
      let text = ''
      for (const child of node.content || []) {
        if (child.type === 'text') text += child.text || ''
        else { runs.push(text); text = '' }
      }
      runs.push(text)
    } else for (const child of node.content || []) visit(child)
  }
  visit(document)
  return runs
}

function domRuns(root) {
  const runs = []
  for (const block of root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,pre')) {
    let run = { text: '', nodes: [] }
    const walker = root.ownerDocument.createTreeWalker(block, 5)
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (node.nodeType === 1) {
        // ProseMirror adds a trailing BR for empty paragraphs; it has no text.
        if (node.tagName === 'BR' && !node.classList.contains('ProseMirror-trailingBreak')) {
          runs.push(run); run = { text: '', nodes: [] }
        }
      } else {
        run.nodes.push({ node, start: run.text.length })
        run.text += node.data
      }
    }
    runs.push(run)
  }
  return runs
}

function findRanges(root, query, matchCase = false, regex = false) {
  const ranges = []
  for (const run of domRuns(root)) {
    for (const { from, to } of matches(run.text, query, matchCase, regex)) {
      const start = run.nodes.find(n => from >= n.start && from < n.start + n.node.length)
      const end = run.nodes.find(n => to > n.start && to <= n.start + n.node.length)
      if (!start || !end) continue
      const range = root.ownerDocument.createRange()
      range.setStart(start.node, from - start.start)
      range.setEnd(end.node, to - end.start)
      ranges.push(range)
    }
  }
  return ranges
}

function findInNotes(notes, query, matchCase, regex = false) {
  const results = []
  for (const note of notes) {
    let ordinal = 0
    const runs = documentRuns(note.doc)
    for (const text of runs) {
      for (const hit of matches(text, query, matchCase, regex)) {
        const start = Math.max(0, hit.from - 45)
        const end = Math.min(text.length, hit.to + 65)
        results.push({
          note, ordinal: ordinal++,
          before: (start ? '…' : '') + text.slice(start, hit.from),
          hit: text.slice(hit.from, hit.to),
          after: text.slice(hit.to, end) + (end < text.length ? '…' : '')
        })
      }
    }
  }
  return results
}
module.exports = { compile, matches, documentRuns, domRuns, findRanges, findInNotes }
