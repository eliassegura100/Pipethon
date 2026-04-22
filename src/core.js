/**
 * core.js - Core Utilities and Data Structures
 *
 * Provides utility functions and foundational data structures used
 * throughout the Pipethon compiler:
 * - AST node constructors and helpers
 * - Type system utilities
 * - Pattern matching utilities
 * - Error handling and reporting
 * - Common algorithms and operations
 */

/**
 * Creates a Program AST node.
 *
 * @param {array} statements - Array of statement nodes
 * @returns {object} Program node
 */
export function createProgram(statements) {
  return {
    type: 'Program',
    statements,
  }
}

/**
 * Creates a pipeline declaration node.
 *
 * @param {string} name - Pipeline name
 * @param {array} statements - Pipeline body statements
 * @returns {object} PipelineDecl node
 */
export function createPipeline(name, statements) {
  return {
    type: 'PipelineDecl',
    name,
    statements,
  }
}

/**
 * Creates a function declaration node.
 *
 * @param {string} name - Function name
 * @param {array} parameters - Array of parameter nodes
 * @param {object} returnType - Return type
 * @param {array} body - Function body statements
 * @returns {object} FunctionDecl node
 */
export function createFunction(name, parameters, returnType, body) {
  return {
    type: 'FunctionDecl',
    name,
    parameters,
    returnType,
    body,
  }
}

/**
 * Creates a match expression node.
 *
 * @param {object} expr - The expression to match
 * @param {array} cases - Array of match case nodes
 * @returns {object} MatchExpr node
 */
export function createMatch(expr, cases) {
  return {
    type: 'MatchExpr',
    expr,
    cases,
  }
}

/**
 * Creates a match case node.
 *
 * @param {object} pattern - The pattern to match
 * @param {object} expr - The expression to evaluate if pattern matches
 * @returns {object} MatchCase node
 */
export function createMatchCase(pattern, expr) {
  return {
    type: 'MatchCase',
    pattern,
    expr,
  }
}

/**
 * Creates a pipe expression node (pipeline operator |).
 *
 * @param {array} stages - Array of expression nodes
 * @returns {object} PipeExpression node
 */
export function createPipeExpression(stages) {
  return {
    type: 'PipeExpression',
    stages,
  }
}

/**
 * Creates an identifier node.
 *
 * @param {string} name - The identifier name
 * @returns {object} Identifier node
 */
export function createIdentifier(name) {
  return {
    type: 'Identifier',
    name,
  }
}

/**
 * Creates a literal value node.
 *
 * @param {*} value - The literal value
 * @param {string} kind - Literal kind ('number', 'string', 'boolean')
 * @returns {object} Literal node
 */
export function createLiteral(value, kind) {
  return {
    type: 'Literal',
    value,
    kind,
  }
}

/**
 * Creates a type annotation node.
 *
 * @param {string} name - Type name
 * @param {array} typeParams - Type parameters (for generic types)
 * @returns {object} Type node
 */
export function createType(name, typeParams = []) {
  return {
    type: 'Type',
    name,
    typeParams,
  }
}

/**
 * Compares two types for equality.
 *
 * @param {object} type1 - First type
 * @param {object} type2 - Second type
 * @returns {boolean} True if types are equal
 */
export function typesEqual(type1, type2) {
  if (type1.name !== type2.name) return false
  if (type1.typeParams.length !== type2.typeParams.length) return false
  return type1.typeParams.every((tp, i) => typesEqual(tp, type2.typeParams[i]))
}

/**
 * Custom error class for semantic errors.
 */
export class SemanticsError extends Error {
  constructor(message, position) {
    super(message)
    this.name = 'SemanticsError'
    this.position = position
    this.isSemanticsError = true
  }
}

/**
 * Reports an error with context information.
 *
 * @param {string} message - Error message
 * @param {number} line - Line number
 * @param {number} column - Column number
 * @returns {object} Formatted error object
 */
export function createError(message, line, column) {
  return {
    message,
    line,
    column,
    severity: 'error',
  }
}

/**
 * Reports a warning with context information.
 *
 * @param {string} message - Warning message
 * @param {number} line - Line number
 * @param {number} column - Column number
 * @returns {object} Formatted warning object
 */
export function createWarning(message, line, column) {
  return {
    message,
    line,
    column,
    severity: 'warning',
  }
}

/**
 * Formats diagnostic messages for console output.
 *
 * @param {array} errors - Array of error objects
 * @param {array} warnings - Array of warning objects
 * @returns {string} Formatted diagnostic output
 */
export function formatDiagnostics(errors = [], warnings = []) {
  const lines = []

  warnings.forEach(w => {
    lines.push(`⚠ Warning at ${w.line}:${w.column}: ${w.message}`)
  })

  errors.forEach(e => {
    lines.push(`✖ Error at ${e.line}:${e.column}: ${e.message}`)
  })

  return lines.join('\n')
}
