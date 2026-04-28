// generator.js — translates the optimized Pipethon AST to JavaScript.
//
// Design notes:
//   - Each Pipethon variable gets a unique JS name (e.g. result_1) to avoid
//     collisions with JS reserved words and shadowed names.
//   - Types are erased — they are only used in the front-end.
//   - llm() calls are emitted as async calls to a runtime helper.
//   - Pipe stages are emitted as chained JS calls on an array/value.
//   - Pattern blocks become JS switch-like if/else chains.
//   - none becomes JS null; Some/None unwrapping emits null checks.
//   - Built-in stages (filter, map, collect, print, tap) emit idiomatic JS.
 
import * as core from "./core.js"
 
// Maps each Variable/NamedPipeline entity to its unique JS identifier.
const names = new Map()
let nextId = 1
 
function jsName(entity) {
  if (!names.has(entity)) {
    const base = typeof entity === "string" ? entity : (entity.name ?? "v")
    names.set(entity, `${base}_${nextId++}`)
  }
  return names.get(entity)
}
 
function gen(node) {
  // Primitive values produced by the optimizer (folded constants) or the
  // analyzer's literal handlers need special serialization.
  if (typeof node === "bigint")  return `${node}n`   // 42n not 42
  if (typeof node === "boolean") return String(node)  // true/false
  if (typeof node === "string")  return node          // already quoted by parser
  return generators?.[node?.kind]?.(node) ?? String(node)
}
 
const generators = {
  Program(p) {
    return p.statements.map(gen).join("\n")
  },
 
  LetDeclaration(d) {
    return `const ${jsName(d.variable)} = ${gen(d.initializer)};`
  },
 
  PipelineDeclaration(d) {
    return `// pipeline ${d.pipe.name} declared`
  },
 
  Pipeline(p) {
    // A pipeline with no stages is just the source expression.
    if (p.stages.length === 0) return gen(p.source)
 
    // Emit as a chain: stages transform the value.
    // Each stage receives the accumulated value.
    let code = gen(p.source)
    for (const stage of p.stages) {
      code = genStage(stage, code)
    }
    return code
  },
 
  // ── Expressions ────────────────────────────────────────────────────────────
  BinaryExpression(e) {
    const op = e.op === "==" ? "===" : e.op === "!=" ? "!==" : e.op
    return `(${gen(e.left)} ${op} ${gen(e.right)})`
  },
 
  UnaryExpression(e) {
    return `(${e.op}${gen(e.operand)})`
  },
 
  // x ?? default  →  (x !== null && x !== undefined ? x : default)
  Coalesce(e) {
    const l = gen(e.left)
    const r = gen(e.right)
    return `(${l} != null ? ${l} : ${r})`
  },
 
  MethodCall(e) {
    const args = e.args.map(gen).join(", ")
    return `${gen(e.object)}.${e.method}(${args})`
  },
 
  MemberAccess(e) {
    return `${gen(e.object)}.${e.field}`
  },
 
  FunctionCall(e) {
    return `${e.callee}(${e.args.map(gen).join(", ")})`
  },
 
  ListLiteral(e) {
    return `[${e.elements.map(gen).join(", ")}]`
  },
 
  ObjectLiteral(e) {
    const fields = e.fields.map((f) => `${f.key}: ${gen(f.value)}`).join(", ")
    return `({ ${fields} })`
  },
 
  // llm() as an expression (e.g. in a match arm body)
  LLMExpression(e) {
    return genLLMCall(e.args)
  },
 
  // none → null in JS
  NoneLiteral(_) {
    return "null"
  },
 
  // Variable reference
  Variable(v) {
    return jsName(v)
  },
}
 
// ── Stage Code Generation ─────────────────────────────────────────────────────
 
function genStage(stage, inputCode) {
  switch (stage.kind) {
    case "RefStage": {
      const name = stage.name
      // Built-in stages
      if (name === "print")   return `(console.log(${inputCode}), ${inputCode})`
      if (name === "collect") return inputCode  // already an array in our model
      if (name === "tap")     return `(console.log(${inputCode}), ${inputCode})`
      // Named pipeline reference
      return `${name}_pipeline(${inputCode})`
    }
 
    case "CallStage": {
      const args = stage.args.map(gen).join(", ")
      return `${stage.name}(${inputCode}, ${args})`
    }
 
    case "LLMStage":
      return `await ${genLLMCall(stage.args, inputCode)}`
 
    case "NamedStage":
      return genNamedStage(stage.name, stage.block, inputCode)
 
    case "AnonStage":
      return genPatternBlockStage(null, stage.block, inputCode)
 
    default:
      return `/* unknown stage */ ${inputCode}`
  }
}
 
// Emit a named stage like filter { ... } or map { ... }
function genNamedStage(name, block, inputCode) {
  switch (name) {
    case "filter":
      return `${inputCode}.filter(($item) => ${genPatternBlockExpr(block, "$item")})`
    case "map":
    case "each":
      return `${inputCode}.map(($item) => ${genPatternBlockExpr(block, "$item")})`
    case "match":
      return genPatternBlockExpr(block, inputCode)
    case "split":
      return `/* split */ ${genPatternBlockExpr(block, inputCode)}`
    default:
      return `${name}(${inputCode}, ($item) => ${genPatternBlockExpr(block, "$item")})`
  }
}
 
function genPatternBlockStage(name, block, inputCode) {
  return genPatternBlockExpr(block, inputCode)
}
 
// Emit a pattern block as a JS IIFE that matches against the given value.
function genPatternBlockExpr(block, valueCode) {
  const arms = block.arms
    .map((arm) => genMatchArm(arm, valueCode))
    .join("\n  else ")
  return `((($v) => {\n  ${arms}\n  throw new Error("No match")\n})(${valueCode}))`
}
 
function genMatchArm(arm, _valueCode) {
  const test = genPatternTest(arm.pattern, "$v")
  const guard = arm.guard ? ` && (${gen(arm.guard)})` : ""
  const body = arm.body?.kind === "Drop" ? "return undefined" : `return ${gen(arm.body)}`
  return `if (${test}${guard}) { ${body} }`
}
 
function genPatternTest(pattern, v) {
  switch (pattern.kind) {
    case "WildcardPattern":
      return "true"
    case "NonePattern":
      return `${v} === null`
    case "SomePattern":
      return `${v} !== null`
    case "TypePattern":
      switch (pattern.typeName) {
        case "int":    return `typeof ${v} === "bigint"`
        case "float":  return `typeof ${v} === "number"`
        case "string": return `typeof ${v} === "string"`
        case "bool":   return `typeof ${v} === "boolean"`
        case "list":   return `Array.isArray(${v})`
        default:       return "true"
      }
    case "LiteralPattern":
      return `${v} === ${gen(pattern.value)}`
    case "EmptyListPattern":
      return `Array.isArray(${v}) && ${v}.length === 0`
    case "SingleListPattern":
      return `Array.isArray(${v}) && ${v}.length === 1`
    case "HeadTailPattern":
      return `Array.isArray(${v}) && ${v}.length >= 1`
    case "ObjectPattern":
      return pattern.fields
        .map((f) => `${v}.hasOwnProperty("${f.field}")`)
        .join(" && ")
    default:
      return "true"
  }
}
 
// Emit a runtime llm() call (async).
function genLLMCall(args, inputCode = null) {
  const argStr = args
    .map((a) => `${a.key}: ${typeof a.value === "string" ? a.value : gen(a.value)}`)
    .join(", ")
  const input = inputCode ? `, input: ${inputCode}` : ""
  return `__llm__({ ${argStr}${input} })`
}
 
export default function generate(program) {
  names.clear()
  nextId = 1
  const prelude = `// Generated by Pipethon compiler\n// Runtime helper for llm() calls must be provided separately.\n`
  return prelude + gen(program)
}