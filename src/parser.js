// parser.js — produces an Ohm match object for a Pipethon source program.
// Throws a descriptive error (with line/col) on any syntax error.
// Semantic analysis is handled separately in analyzer.js.

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import ohm from "ohm-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const grammar = ohm.grammar(
  fs.readFileSync(path.join(__dirname, "pipethon.ohm"), "utf-8")
)

export default function parse(sourceCode) {
  const match = grammar.match(sourceCode)
  if (!match.succeeded()) throw new Error(match.message)
  return match
}