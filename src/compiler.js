/**
 * compiler.js - Pipethon Compiler
 *
 * Orchestrates the complete compilation pipeline:
 * 1. Parsing: Converts source code to AST
 * 2. Analysis: Performs static semantic checks
 * 3. Optimization: Improves code quality
 * 4. Generation: Produces target code
 *
 * This module provides the main compilation interface and handles
 * the flow of data through each compilation phase.
 */

import { parse } from './parser.js'
import { analyze } from './analyzer.js'
import { optimize } from './optimizer.js'
import { generate } from './generator.js'

/**
 * Compiles Pipethon source code to target code.
 *
 * @param {string} sourceCode - The Pipethon source code
 * @param {object} options - Compilation options
 * @returns {object} Compilation result with generated code and diagnostics
 */
export function compile(sourceCode, options = {}) {
  const opts = {
    optimize: true,
    target: 'javascript',
    ...options,
  }

  try {
    // Phase 1: Parsing
    const ast = parse(sourceCode)

    // Phase 2: Analysis
    const analysisResult = analyze(ast)

    if (!analysisResult.isValid) {
      return {
        success: false,
        code: null,
        diagnostics: analysisResult.diagnostics,
      }
    }

    // Phase 3: Optimization (optional)
    let optimizedAst = analysisResult.ast
    if (opts.optimize) {
      optimizedAst = optimize(analysisResult.ast)
    }

    // Phase 4: Code Generation
    const code = generate(optimizedAst, opts.target)

    return {
      success: true,
      code,
      diagnostics: analysisResult.diagnostics,
    }
  } catch (error) {
    return {
      success: false,
      code: null,
      diagnostics: {
        errors: [error.message],
        warnings: [],
      },
    }
  }
}

/**
 * Compiles and returns just the generated code.
 *
 * @param {string} sourceCode - The Pipethon source code
 * @param {string} target - Target language ('javascript')
 * @returns {string} Generated target code
 * @throws {Error} If compilation fails
 */
export function compileToCode(sourceCode, target = 'javascript') {
  const result = compile(sourceCode, { target })

  if (!result.success) {
    const errorMessages = result.diagnostics.errors.join('\n')
    throw new Error(`Compilation failed:\n${errorMessages}`)
  }

  return result.code
}

export { parse, analyze, optimize, generate }
