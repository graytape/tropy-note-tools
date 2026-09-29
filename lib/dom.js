'use strict'

// Build controls without interpreting strings as HTML.
exports.element = function (doc, tag, attrs = {}, text = '') {
  const node = doc.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  node.textContent = text
  return node
}
exports.button = function (doc, label, text, action) {
  const node = exports.element(doc, 'button', { type: 'button', title: label, 'aria-label': label }, text)
  // Preserve the editor selection when toolbar buttons are clicked.
  node.addEventListener('mousedown', event => event.preventDefault())
  node.addEventListener('click', action)
  return node
}
