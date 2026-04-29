// optimizer.js — AST-level optimizations for Pipethon.
//
// Dispatches on node.kind using the optimizers table.
// Nodes without an entry pass through unchanged (the ?? node fallback).
//
// Current optimizations:
//   - Constant folding for numeric binary expressions
//   - Boolean short-circuit simplification
//   - Strength reductions (x+0, x*1, x*0, 0+x, etc.)
//   - Dead-branch elimination in pattern blocks with literal test values
//   - Coalesce with a known-present value (non-optional left side folds away)

import * as core from "./core.js"

export default function optimize(node) {
  return optimizers?.[node?.kind]?.(node) ?? node
}

const isZero = (n) => n === 0 || n === 0n
const isOne  = (n) => n === 1 || n === 1n

const optimizers = {
  Program(p) {
    p.statements = p.statements.flatMap(optimize)
    return p
  },

  LetDeclaration(d) {
    d.initializer = optimize(d.initializer)
    return d
  },

  PipelineDeclaration(d) {
    d.pipe = optimize(d.pipe)
    return d
  },

  NamedPipeline(p) {
    p.pipeline = optimize(p.pipeline)
    return p
  },

  Pipeline(p) {
    p.source = optimize(p.source)
    p.stages = p.stages.map(optimize)
    return p
  },

  NamedStage(s) {
    s.block = optimize(s.block)
    return s
  },

  AnonStage(s) {
    s.block = optimize(s.block)
    return s
  },

  PatternBlock(b) {
    b.arms = b.arms.map(optimize)
    return b
  },

  MatchArm(a) {
    if (a.guard) a.guard = optimize(a.guard)
    if (a.body?.kind !== "Drop") a.body = optimize(a.body)
    return a
  },

  // ?? — if the left side optimizes to a non-none literal, fold to it
  Coalesce(e) {
    e.left  = optimize(e.left)
    e.right = optimize(e.right)
    // If the left is definitely not none (e.g. a string/number literal), fold
    if (e.left?.kind !== "NoneLiteral" && !core.isOptional(e.left?.type)) {
      return e.left
    }
    // If the left is none, fold to the right (default)
    if (e.left?.kind === "NoneLiteral") {
      return e.right
    }
    return e
  },

  BinaryExpression(e) {
    e.left  = optimize(e.left)
    e.right = optimize(e.right)

    // Boolean short-circuits
    if (e.op === "&&") {
      if (e.left === true)  return e.right
      if (e.right === true) return e.left
      if (e.left === false || e.right === false) return false
    }
    if (e.op === "||") {
      if (e.left === false)  return e.right
      if (e.right === false) return e.left
      if (e.left === true || e.right === true) return true
    }

    // Numeric constant folding
    const lNum = [Number, BigInt].includes(e.left?.constructor)
    const rNum = [Number, BigInt].includes(e.right?.constructor)

    if (lNum && rNum) {
      if (e.op === "+")  return e.left + e.right
      if (e.op === "-")  return e.left - e.right
      if (e.op === "*")  return e.left * e.right
      if (e.op === "/")  return e.left / e.right
      if (e.op === "%")  return e.left % e.right
      if (e.op === "**") return e.left ** e.right
      if (e.op === "<")  return e.left < e.right
      if (e.op === "<=") return e.left <= e.right
      if (e.op === "==") return e.left === e.right
      if (e.op === "!=") return e.left !== e.right
      if (e.op === ">=") return e.left >= e.right
      if (e.op === ">")  return e.left > e.right
    }

    // Strength reductions — left operand is a known constant
    if (lNum) {
      if (isZero(e.left) && e.op === "+") return e.right
      if (isOne(e.left)  && e.op === "*") return e.right
      if (isZero(e.left) && e.op === "-") return core.unary("-", e.right, e.right.type)
      if (isZero(e.left) && ["*", "/"].includes(e.op)) return e.left
    }

    // Strength reductions — right operand is a known constant
    if (rNum) {
      if (["+", "-"].includes(e.op) && isZero(e.right)) return e.left
      if (["*", "/"].includes(e.op) && isOne(e.right))  return e.left
      if (e.op === "*"  && isZero(e.right)) return e.right
      if (e.op === "**" && isZero(e.right)) return 1
    }

    return e
  },

  UnaryExpression(e) {
    e.operand = optimize(e.operand)
    if (e.op === "-") {
      if (e.operand?.constructor === Number) return -e.operand
      if (e.operand?.constructor === BigInt)  return -e.operand
    }
    if (e.op === "!" && e.operand?.constructor === Boolean) return !e.operand
    return e
  },

  MethodCall(e) {
    e.object = optimize(e.object)
    e.args   = e.args.map(optimize)
    return e
  },

  FunctionCall(e) {
    e.args = e.args.map(optimize)
    return e
  },

  ListLiteral(e) {
    e.elements = e.elements.map(optimize)
    return e
  },

  ObjectLiteral(e) {
    e.fields = e.fields.map((f) => ({ ...f, value: optimize(f.value) }))
    return e
  },

  LLMStage(s) {
    return s  // LLM calls are opaque at compile time
  },

  LLMExpression(e) {
    return e  // same
  },
}