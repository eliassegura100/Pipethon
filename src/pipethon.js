#!/usr/bin/env node

// pipethon.js — CLI entry point for the Pipethon compiler
//
// Usage:
//   pipethon <command> [options]
//
// Commands:
//   check <file>       Check if source code has valid syntax
//   parse <file>       Parse and print the raw match result
//   analyze <file>     Analyze and print the internal AST
//   optimize <file>    Print the optimized AST
//   generate <file>    Print the generated JavaScript
//   compile <file>     Full compilation; use -o <output> to write to a file
//
// Options:
//   -h, --help         Show this help message
//   -v, --version      Show version

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import stringify from "graph-stringify"
import compile from "./compiler.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Help / version ────────────────────────────────────────────────────────────

function getVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
    )
    return pkg.version ?? "0.1.0"
  } catch {
    return "0.1.0"
  }
}

const help = `
Pipethon v${getVersion()} — Flow. Match. Think.

Usage: pipethon <command> [options]

Commands:
  check <file>       Check if source code has valid syntax
  parse <file>       Parse and display the match result
  analyze <file>     Perform semantic analysis and display the AST
  optimize <file>    Display the optimized AST
  generate <file>    Generate and display JavaScript output
  compile <file>     Full compilation pipeline
                       -o <output>   Write JS output to a file

Options:
  -h, --help         Show this help message
  -v, --version      Show version number
`

// ── File reading ──────────────────────────────────────────────────────────────

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8")
  } catch (e) {
    throw new Error(`Cannot read file '${filePath}': ${e.message}`)
  }
}

// ── Output helpers ────────────────────────────────────────────────────────────

// Pretty-print an AST node (graph-stringify) or fall back to plain output.
function printResult(result) {
  const out = stringify(result, "kind")
  console.log(out ?? result)
}

function fail(message) {
  console.error(`\u001b[31m${message}\u001b[39m`)
  process.exitCode = 1
}

// ── Command handlers ──────────────────────────────────────────────────────────

function handleCheck(args) {
  if (!args[0]) return fail("Usage: pipethon check <file>")
  const source = readFile(args[0])
  try {
    compile(source, "parsed")
    console.log(`✓ ${args[0]} has valid syntax`)
  } catch (e) {
    fail(`Syntax error in ${args[0]}:\n${e.message}`)
  }
}

function handleParse(args) {
  if (!args[0]) return fail("Usage: pipethon parse <file>")
  const source = readFile(args[0])
  try {
    const result = compile(source, "parsed")
    console.log(result)
  } catch (e) {
    fail(`Parse error:\n${e.message}`)
  }
}

function handleAnalyze(args) {
  if (!args[0]) return fail("Usage: pipethon analyze <file>")
  const source = readFile(args[0])
  try {
    const result = compile(source, "analyzed")
    printResult(result)
  } catch (e) {
    fail(`Analysis error:\n${e.message}`)
  }
}

function handleOptimize(args) {
  if (!args[0]) return fail("Usage: pipethon optimize <file>")
  const source = readFile(args[0])
  try {
    const result = compile(source, "optimized")
    printResult(result)
  } catch (e) {
    fail(`Optimization error:\n${e.message}`)
  }
}

function handleGenerate(args) {
  if (!args[0]) return fail("Usage: pipethon generate <file>")
  const source = readFile(args[0])
  try {
    const result = compile(source, "js")
    console.log(result)
  } catch (e) {
    fail(`Code generation error:\n${e.message}`)
  }
}

function handleCompile(args) {
  if (!args[0]) return fail("Usage: pipethon compile <file> [-o <output>]")
  const source = readFile(args[0])
  const outputIndex = args.indexOf("-o")
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null
  try {
    const result = compile(source, "js")
    if (outputPath) {
      fs.writeFileSync(outputPath, result, "utf-8")
      console.log(`✓ Compiled ${args[0]} → ${outputPath}`)
    } else {
      console.log(result)
    }
  } catch (e) {
    fail(`Compilation failed:\n${e.message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const [command, ...commandArgs] = process.argv.slice(2)

if (!command || command === "--help" || command === "-h") {
  console.log(help)
} else if (command === "--version" || command === "-v") {
  console.log(`Pipethon v${getVersion()}`)
} else {
  switch (command) {
    case "check":    handleCheck(commandArgs);    break
    case "parse":    handleParse(commandArgs);    break
    case "analyze":  handleAnalyze(commandArgs);  break
    case "optimize": handleOptimize(commandArgs); break
    case "generate": handleGenerate(commandArgs); break
    case "compile":  handleCompile(commandArgs);  break
    default:
      fail(`Unknown command: '${command}'\nRun 'pipethon --help' for usage.`)
  }
}