import { StreamLanguage, StringStream } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { autocompletion, CompletionContext, CompletionResult, snippetCompletion } from '@codemirror/autocomplete'

// Cache the last successful list of components
const cachedComponentsEffect = StateEffect.define<string[]>()

const cachedComponentsField = StateField.define<string[]>({
  create() {
    return []
  },
  update(components, tr) {
    for (const e of tr.effects) {
      if (e.is(cachedComponentsEffect)) {
        return e.value
      }
    }
    return components
  }
})

// Component types and their possible component categories
const componentTypes = [
  'business',
  'application',
  'technology'
]

const componentCategories = [
  'actor',
  'application',
  'artifact',
  'business',
  'collaboration',
  'communication_network',
  'component',
  'contract',
  'data',
  'database',
  'device',
  'event',
  'function',
  'interaction',
  'interface',
  'node',
  'object',
  'process',
  'role',
  'service',
  'system_software',
  'technology'
]

interface Relationship {
  symbol: string;
  description: string;
}

const relationships: Relationship[] = [
  { symbol: '-->', description: 'Access' },
  { symbol: 'o-', description: 'Aggregation' },
  { symbol: '-', description: 'Association' },
  { symbol: '.--.', description: 'Assignment' },
  { symbol: '+-', description: 'Composition' },
  { symbol: '--|>', description: 'Flow' },
  { symbol: '--:>', description: 'Realization' },
  { symbol: '-|>', description: 'Triggering' },
  { symbol: '->', description: 'Serving' },
  { symbol: '-:>', description: 'Specialization' }
]

// Autocompletion function
function nomnomlComplete(context: CompletionContext): CompletionResult | null {
  let word = context.matchBefore(/\w*/)
  if (!word) return null

  let options: any[] = []
  let text = context.state.doc.sliceString(0, context.pos).trimEnd()
  let lastChar = text[text.length - 1]

  // If we're at the start of file, line, or after whitespace, suggest components
  if (
    lastChar === undefined ||
    relationships.some(rel => text.endsWith(rel.symbol.trim())) || // check if text ends with a relationship symbol
    context.state.doc.lineAt(context.pos).from === context.pos // check if cursor is at the start of a line (i.e., on a new line)
  ) {
    // Get existing components from cache or calculate them
    const existingComponents = context.state.field(cachedComponentsField);

    options = [
      snippetCompletion("[#{1}]", {
        label: "[new element]",
        type: 'bracket',
        boost: 99 // Make this appear first
      })
    ];

    // Add existing components as suggestions
    existingComponents.forEach(component => {
      options.push(snippetCompletion(`[${component}]#{1}`, {
        label: `[${component}]`,
        type: 'bracket',
        detail: 'existing element'
      }));
    });
  }
  // If we're after an opening bracket, suggest "<layer:type>"
  else if (lastChar === '[') {
    options = [
      snippetCompletion("<#{1}>", {
        label: "<layer:type>",
        type: 'keyword'
      })
    ]
  }
  // If we're between < >, suggest component types
  else if (text.endsWith("<") || (text.endsWith("<") && text.match(/\[</))) {
    options = componentTypes.map(type => ({
      label: type,
      type: 'keyword',
      apply: type + ":" // Automatically add the colon after selection
    }))
  }
  // If we're after a colon in a component type declaration, suggest component categories
  else if (lastChar === ':' && text.match(/\[<\w+:$/)) {
    options = componentCategories.map(category => ({
      label: category,
      type: 'type',
      apply: (view, completion, from, to) => {
        const doc = view.state.doc;
        // Check if the next character is '>'
        const nextChar = doc.sliceString(to, to + 1);
        let insertText: string;
        let insertLen: number;
        if (nextChar !== '>') {
          insertText = category + '>';
          insertLen = insertText.length;
        } else {
          insertText = category;
          insertLen = insertText.length + 1; // move cursor after '>'
        }
        view.dispatch({
          changes: { from, to, insert: insertText },
          selection: { anchor: from + insertLen }
        });
      }
    }))
  }
  // If we're after a closing bracket, suggest relationships
  else if (lastChar === ']') {
    options = relationships.map(rel => ({
      label: ' ' + rel.symbol + ' ',
      detail: rel.description,
      type: 'operator'
    }))
  }

  return {
    from: word.from,
    options,
    validFor: /^\w*$/
  }
}

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

// Export the mode with highlighting and autocompletion
export const nomnoml = [
  nomnomlMode,
  syntaxHighlighting(nomnomlHighlightStyle),
  cachedComponentsField,
  autocompletion({
    override: [nomnomlComplete],
    activateOnTyping: true,
    activateOnCompletion(completion) {
      return true;
    },
  })
]

// Export the effect so it can be used when diagram is rendered
export { cachedComponentsEffect }

// Effect to add and remove errors
export const addErrorEffect = StateEffect.define<{ line: number, column: number } | null>()

// Define a state field to store the error decorations
export const errorField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(errors, tr) {
    // Clear errors when the document changes
    if (tr.docChanged) {
      return Decoration.none
    }

    // Update errors when the effect is dispatched
    for (const e of tr.effects) {
      if (e.is(addErrorEffect)) {
        if (e.value === null) {
          return Decoration.none
        }

        const { line, column } = e.value
        const doc = tr.state.doc
        const lineStart = doc.line(line).from
        const errorPos = lineStart + column - 1

        // Create decorations
        const builder = new RangeSetBuilder<Decoration>()

        // Add line decoration
        builder.add(lineStart, lineStart, Decoration.line({
          class: 'cm-error-line'
        }))

        // Add character decoration
        builder.add(errorPos, errorPos + 1, Decoration.mark({
          class: 'cm-error'
        }))

        return builder.finish()
      }
    }

    return errors
  },
  provide: f => EditorView.decorations.from(f)
})
