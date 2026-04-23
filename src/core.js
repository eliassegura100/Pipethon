// core.js — internal program representation for Pipethon.
//
// Every node is a plain JS object with a "kind" property.
// The analyzer attaches a "type" property to all expression nodes.
//
// Key null-safety design:
//   - optionalType(base) is the ONLY type that can hold none.
//   - anyType is non-nullable (Any ≠ Any?).
//   - none is only valid as a value when the target type is optional.
//   - llm() always produces optionalType(stringType).

// ── Primitive Types ───────────────────────────────────────────────────────────

export const intType    = "Int"
export const floatType  = "Float"
export const stringType = "String"
export const boolType   = "Bool"
export const listType   = "List"
export const anyType    = "Any"
// export const voidType   = "Void"

// The one composite type that carries nullability.
export function optionalType(baseType) {
  return { kind: "OptionalType", baseType }
}

export function isOptional(type) {
  return type?.kind === "OptionalType"
}

// ── Program ───────────────────────────────────────────────────────────────────

export function program(statements) {
  return { kind: "Program", statements }
}

// ── Declarations ─────────────────────────────────────────────────────────────

export function letDeclaration(variable, initializer) {
  return { kind: "LetDeclaration", variable, initializer }
}

// A variable entity — stored in scope, referenced by Variable nodes.
export function variable(name, type) {
  return { kind: "Variable", name, type }
}

export function pipelineDeclaration(pipe) {
  return { kind: "PipelineDeclaration", pipe }
}

// A named pipeline entity.
export function namedPipeline(name, pipeline, type) {
  return { kind: "NamedPipeline", name, pipeline, type }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

// source: the initial expression; stages: array of PipeStage nodes
export function pipeline(source, stages) {
  return { kind: "Pipeline", source, stages }
}

// ── Pipe Stages ───────────────────────────────────────────────────────────────

// filter { ... }  map { ... }  match { ... }  etc.
export function namedStage(name, block) {
  return { kind: "NamedStage", name, block }
}

// A bare { ... } pattern block used directly as a pipe stage
export function anonStage(block) {
  return { kind: "AnonStage", block }
}

// A named pipe stage called with arguments: sort(key)
export function callStage(name, args) {
  return { kind: "CallStage", name, args }
}

// A named reference to a built-in or declared pipeline: |> collect
export function refStage(name) {
  return { kind: "RefStage", name }
}

// llm(model: "claude", prompt: "...", format: json)
// Always produces optionalType(stringType) since model output can be none.
export function llmStage(args) {
  return { kind: "LLMStage", args, type: optionalType(stringType) }
}

// ── Pattern Blocks ────────────────────────────────────────────────────────────

export function patternBlock(arms) {
  return { kind: "PatternBlock", arms }
}

export function matchArm(pattern, guard, body) {
  return { kind: "MatchArm", pattern, guard, body }
}

// Sentinel for the drop keyword in an arm body
export const dropAction = { kind: "Drop" }

// ── Patterns ──────────────────────────────────────────────────────────────────

// some(x) — unwraps an optional value; binding becomes the inner value
export function somePattern(binding) {
  return { kind: "SomePattern", binding }
}

// none — matches the absent case of an optional
export const nonePattern = { kind: "NonePattern" }

// int(n), float(f), string(s), bool(b), list(xs)
export function typePattern(typeName, binding) {
  return { kind: "TypePattern", typeName, binding }
}

export function emptyListPattern() {
  return { kind: "EmptyListPattern" }
}

export function singleListPattern(binding) {
  return { kind: "SingleListPattern", binding }
}

export function headTailPattern(head, tail) {
  return { kind: "HeadTailPattern", head, tail }
}

// { name: n, age: a }
export function objectPattern(fields) {
  return { kind: "ObjectPattern", fields }
}

// { name, age } — shorthand where field name = binding name
export function fieldPattern(field, binding) {
  return { kind: "FieldPattern", field, binding }
}

// Matches a specific literal value
export function literalPattern(value) {
  return { kind: "LiteralPattern", value }
}

// _ — matches anything, must be the last arm
export const wildcardPattern = { kind: "WildcardPattern" }

// ── Expressions ───────────────────────────────────────────────────────────────

export function binary(op, left, right, type) {
  return { kind: "BinaryExpression", op, left, right, type }
}

export function unary(op, operand, type) {
  return { kind: "UnaryExpression", op, operand, type }
}

// x ?? default — left must be optional; result has the base type
export function coalesce(left, right, type) {
  return { kind: "Coalesce", left, right, type }
}

export function methodCall(object, method, args, type) {
  return { kind: "MethodCall", object, method, args, type }
}

export function memberAccess(object, field, type) {
  return { kind: "MemberAccess", object, field, type }
}

export function functionCall(callee, args, type) {
  return { kind: "FunctionCall", callee, args, type }
}

export function listLiteral(elements) {
  return { kind: "ListLiteral", elements, type: listType }
}

export function objectLiteral(fields) {
  return { kind: "ObjectLiteral", fields, type: "Object" }
}

// llm(...) as an expression (e.g. as the body of a match arm)
export function llmExpression(args) {
  return { kind: "LLMExpression", args, type: optionalType(stringType) }
}

// The none literal — only valid in optional type contexts
export const noneLiteral = { kind: "NoneLiteral" }

// ── Literals (JS primitives) ──────────────────────────────────────────────────
// Following the Carlos compiler convention:
//   Pipethon Int    → JS BigInt
//   Pipethon Float  → JS Number
//   Pipethon Bool   → JS Boolean  (true / false)
//   Pipethon String → JS String   (including quote characters)
//
// We monkey-patch the prototype so every expression node has a .type property.

BigInt.prototype.type   = intType     // NOSONAR
Number.prototype.type   = floatType   // NOSONAR
Boolean.prototype.type  = boolType    // NOSONAR
String.prototype.type   = stringType  // NOSONAR

// ── Standard Library ──────────────────────────────────────────────────────────
// Built-in pipe stage names and type names available in every program.

export const standardLibrary = Object.freeze({
  // Type names (used in TypeAnnot)
  Int:    intType,
  Float:  floatType,
  String: stringType,
  Bool:   boolType,
  List:   listType,
  Any:    anyType,

  // Built-in pipe stages
  print:   { kind: "BuiltinStage", name: "print",   takesBlock: false },
  collect: { kind: "BuiltinStage", name: "collect", takesBlock: false },
  tap:     { kind: "BuiltinStage", name: "tap",     takesBlock: false },
  filter:  { kind: "BuiltinStage", name: "filter",  takesBlock: true  },
  map:     { kind: "BuiltinStage", name: "map",     takesBlock: true  },
  match:   { kind: "BuiltinStage", name: "match",   takesBlock: true  },
  each:    { kind: "BuiltinStage", name: "each",    takesBlock: true  },
  split:   { kind: "BuiltinStage", name: "split",   takesBlock: true  },
})