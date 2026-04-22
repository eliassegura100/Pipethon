#!/usr/bin/env node

/**
 * pipethon.js - Pipethon Compiler CLI
 *
 * Command-line interface for the Pipethon compiler. Provides commands for:
 * - Syntax checking: pipethon check <file>
 * - Parsing: pipethon parse <file>
 * - Analysis: pipethon analyze <file>
 * - Optimization: pipethon optimize <file>
 * - Code generation: pipethon generate <file>
 * - Full compilation: pipethon compile <file> -o <output>
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { compile } from './compiler.js'
import { parse } from './parser.js'
import { analyze } from './analyzer.js'
import { optimize } from './optimizer.js'
import { generate } from './generator.js'
import { formatDiagnostics } from './core.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Main CLI handler.
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    printHelp()
    process.exit(0)
  }

  const command = args[0]
  const commandArgs = args.slice(1)

  try {
    switch (command) {
      case 'check':
        handleCheck(commandArgs)
        break
      case 'parse':
        handleParse(commandArgs)
        break
      case 'analyze':
        handleAnalyze(commandArgs)
        break
      case 'optimize':
        handleOptimize(commandArgs)
        break
      case 'generate':
        handleGenerate(commandArgs)
        break
      case 'compile':
        handleCompile(commandArgs)
        break
      case '--version':
      case '-v':
        printVersion()
        break
      case '--help':
      case '-h':
        printHelp()
        break
      default:
        console.error(`Unknown command: ${command}`)
        printHelp()
        process.exit(1)
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Checks if source code has valid syntax.
 */
function handleCheck(args) {
  if (args.length === 0) {
    console.error('Usage: pipethon check <file>')
    process.exit(1)
  }

  const filePath = args[0]
  const sourceCode = readFile(filePath)

  try {
    parse(sourceCode)
    console.log(`✓ ${filePath} has valid syntax`)
  } catch (error) {
    console.error(`✖ Syntax error in ${filePath}:`)
    console.error(error.message)
    process.exit(1)
  }
}

/**
 * Parses source code and outputs the AST.
 */
function handleParse(args) {
  if (args.length === 0) {
    console.error('Usage: pipethon parse <file>')
    process.exit(1)
  }

  const filePath = args[0]
  const sourceCode = readFile(filePath)

  try {
    const ast = parse(sourceCode)
    console.log(JSON.stringify(ast, null, 2))
  } catch (error) {
    console.error(`Parse error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Analyzes source code and reports semantic issues.
 */
function handleAnalyze(args) {
  if (args.length === 0) {
    console.error('Usage: pipethon analyze <file>')
    process.exit(1)
  }

  const filePath = args[0]
  const sourceCode = readFile(filePath)

  try {
    const ast = parse(sourceCode)
    const result = analyze(ast)

    if (!result.isValid) {
      console.error('Analysis found semantic errors:')
      console.error(
        formatDiagnostics(result.diagnostics.errors, result.diagnostics.warnings),
      )
      process.exit(1)
    } else {
      console.log(`✓ ${filePath} passed semantic analysis`)
      if (result.diagnostics.warnings.length > 0) {
        console.log('Warnings:')
        console.log(formatDiagnostics([], result.diagnostics.warnings))
      }
    }
  } catch (error) {
    console.error(`Analysis error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Optimizes code and outputs the optimized AST.
 */
function handleOptimize(args) {
  if (args.length === 0) {
    console.error('Usage: pipethon optimize <file>')
    process.exit(1)
  }

  const filePath = args[0]
  const sourceCode = readFile(filePath)

  try {
    const ast = parse(sourceCode)
    const analysisResult = analyze(ast)

    if (!analysisResult.isValid) {
      console.error('Semantic errors prevent optimization:')
      console.error(
        formatDiagnostics(analysisResult.diagnostics.errors, analysisResult.diagnostics.warnings),
      )
      process.exit(1)
    }

    const optimizedAst = optimize(analysisResult.ast)
    console.log(JSON.stringify(optimizedAst, null, 2))
  } catch (error) {
    console.error(`Optimization error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Generates target code from source.
 */
function handleGenerate(args) {
  if (args.length === 0) {
    console.error('Usage: pipethon generate <file> [-t target]')
    process.exit(1)
  }

  const filePath = args[0]
  const targetIndex = args.indexOf('-t')
  const target = targetIndex !== -1 ? args[targetIndex + 1] : 'javascript'

  const sourceCode = readFile(filePath)

  try {
    const ast = parse(sourceCode)
    const analysisResult = analyze(ast)

    if (!analysisResult.isValid) {
      console.error('Semantic errors prevent code generation:')
      console.error(
        formatDiagnostics(analysisResult.diagnostics.errors, analysisResult.diagnostics.warnings),
      )
      process.exit(1)
    }

    const optimizedAst = optimize(analysisResult.ast)
    const code = generate(optimizedAst, target)
    console.log(code)
  } catch (error) {
    console.error(`Code generation error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Compiles source code to target code.
 */
function handleCompile(args) {
  if (args.length === 0) {
    console.error('Usage: pipethon compile <file> [-o output]')
    process.exit(1)
  }

  const filePath = args[0]
  const outputIndex = args.indexOf('-o')
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null

  const sourceCode = readFile(filePath)
  const result = compile(sourceCode)

  if (!result.success) {
    console.error('Compilation failed:')
    console.error(
      formatDiagnostics(result.diagnostics.errors, result.diagnostics.warnings),
    )
    process.exit(1)
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, result.code)
    console.log(`✓ Compiled to ${outputPath}`)
  } else {
    console.log(result.code)
  }
}

/**
 * Reads a file and returns its contents.
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    throw new Error(`Cannot read file ${filePath}: ${error.message}`)
  }
}

/**
 * Prints help information.
 */
function printHelp() {
  console.log(`
Pipethon Compiler v${getVersion()}

Usage: pipethon <command> [options]

Commands:
  check <file>        Check if source code has valid syntax
  parse <file>        Parse source code and output AST
  analyze <file>      Perform semantic analysis
  optimize <file>     Optimize code and output AST
  generate <file>     Generate target code
  compile <file>      Compile source code to target code
                      Options:
                        -o <output>     Write output to file
                        -t <target>     Target language (default: javascript)

Options:
  -h, --help          Show this help message
  -v, --version       Show version
`)
}

/**
 * Prints version information.
 */
function printVersion() {
  console.log(`Pipethon v${getVersion()}`)
}

/**
 * Gets the version from package.json.
 */
function getVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`)
  process.exit(1)
})
