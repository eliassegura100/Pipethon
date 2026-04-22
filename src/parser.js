/**
 * parser.js - Pipethon Parser
 *
 * Transforms source code into an Abstract Syntax Tree (AST) using the Ohm
 * grammar defined in pipethon.ohm. This module provides the parsing interface
 * for converting raw Pipethon source text into a structured representation
 * suitable for analysis and code generation.
 */

import ohm from 'ohm-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load the Ohm grammar
const grammarPath = path.join(__dirname, 'pipethon.ohm')
const grammarText = fs.readFileSync(grammarPath, 'utf-8')
const grammar = ohm.grammar(grammarText)

/**
 * Parses Pipethon source code and returns an AST.
 *
 * @param {string} sourceCode - The Pipethon source code to parse
 * @returns {object} The Abstract Syntax Tree
 * @throws {Error} If the source code is invalid according to the grammar
 */
export function parse(sourceCode) {
  const match = grammar.match(sourceCode)

  if (!match.succeeded()) {
    const error = new Error('Parse error')
    error.message = match.message
    error.pos = match.getPos()
    throw error
  }

  const semantics = grammar.createSemantics()
  semantics.addOperation('ast', {
    // AST building operations will be defined here
    _default(...children) {
      if (children.length === 1) return children[0].ast
      return { children: children.map(c => c.ast) }
    },
  })

  return semantics(match).ast
}

/**
 * Checks if source code is syntactically valid.
 *
 * @param {string} sourceCode - The source code to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidSyntax(sourceCode) {
  try {
    const match = grammar.match(sourceCode)
    return match.succeeded()
  } catch {
    return false
  }
}

export { grammar }
