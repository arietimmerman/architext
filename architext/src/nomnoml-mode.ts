import { StreamLanguage, StringStream } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'

// Define the nomnoml mode
const nomnomlMode = StreamLanguage.define({
  token(stream: StringStream) {
    if (stream.sol()) {
      stream.eatSpace()
      if (stream.peek() === '#') {
        stream.skipToEnd()
        return 'meta'
      }
      if (stream.match('//')) {
        stream.skipToEnd()
        return 'comment'
      }
    }

    const delimiters = '[]|;'.split('')
    const operator = '<>()+-:'.split('')
    const all = [...delimiters, ...operator]

    if (stream.peek() === '<') {
      stream.eat('<')
      if (stream.skipTo('>')) {
        stream.eat('>')
        return 'keyword'
      }
      return null
    }

    if (delimiters.some((c) => stream.eat(c))) return 'bracket'
    if (operator.some((c) => stream.eat(c))) return 'operator'
    stream.eatWhile((c: string) => all.indexOf(c) === -1)
    return null
  }
})

// Define the highlighting style
const nomnomlHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, class: 'cm-meta' },
  { tag: tags.comment, class: 'cm-comment' },
  { tag: tags.keyword, class: 'cm-keyword' },
  { tag: tags.bracket, class: 'cm-bracket' },
  { tag: tags.operator, class: 'cm-operator' }
])

// Export the mode with highlighting
export const nomnoml = [
  nomnomlMode,
  syntaxHighlighting(nomnomlHighlightStyle)
] 