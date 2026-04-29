// analyzer.js — semantic analysis for Pipethon.
//
// Accepts the Ohm match object from parser.js and produces the annotated
// internal program representation, enforcing all static rules along the way.
//
// Static rules enforced here:
//   1.  none can only be assigned to an explicitly optional (Type?) variable
//   2.  Unannotated variables are Any (non-nullable) — not Any?
//   3.  The ?? operator requires an optional-typed left operand
//   4.  Optional values cannot flow into a pipe stage without unwrapping
//   5.  llm() always produces String? (optional)
//   6.  Pattern blocks must be exhaustive (have a _ wildcard) or cover
//       both some(x) and none for optionals
//   7.  The wildcard _ must be the last arm in a pattern block
//   8.  Unreachable arms after _ are a semantic error
//   9.  Guard conditions must evaluate to Bool
//   10. Duplicate field names in object patterns are an error
//   11. Variables and named pipelines must be declared before use
//   12. Duplicate declarations in the same scope are an error
//   13. drop is only valid as an arm body inside a filter or map stage

import * as core from "./core.js"

// ── Context (scope) ───────────────────────────────────────────────────────────

class Context {
  constructor({ parent = null, locals = new Map(), inPipeBlock = null } = {}) {
    Object.assign(this, { parent, locals, inPipeBlock })
  }

  add(name, entity) {
    this.locals.set(name, entity)
  }

  lookup(name) {
    if (this.locals.has(name)) return this.locals.get(name)
    if (this.parent) return this.parent.lookup(name)
    return undefined
  }

  static root() {
    return new Context({ locals: new Map(Object.entries(core.standardLibrary)) })
  }

  newChildContext(props = {}) {
    return new Context({ ...this, ...props, parent: this, locals: new Map() })
  }
}

// ── Constraint Gate ───────────────────────────────────────────────────────────
//
// must(condition, message, { at: ohmNode }) is the single place semantic errors
// are thrown. The errorLocation provides Ohm's line/col prefix.

function must(condition, message, errorLocation) {
  if (!condition) {
    throw new Error(`${errorLocation.at.source.getLineAndColumnMessage()}${message}`)
  }
}

Object.assign(must, {
  notAlreadyDeclared(context, name, at) {
    must(!context.locals.has(name), `'${name}' is already declared in this scope`, at)
  },

  haveBeenDeclared(entity, name, at) {
    must(entity, `'${name}' is not declared`, at)
  },

  // ── Null-safety rules ──────────────────────────────────────────────────────

  // none may only appear where the target type is optional
  noneOnlyInOptionalContext(targetType, at) {
    must(
      core.isOptional(targetType),
      `Cannot assign 'none' to non-optional type '${targetType}'. ` +
        `Declare the type as '${targetType}?' to allow none.`,
      at
    )
  },

  // Optional values must be unwrapped before use (via ?? or some/none pattern)
  notOptionalWithoutUnwrap(type, at) {
    must(
      !core.isOptional(type),
      `Value of type '${typeDesc(type)}' is optional and must be unwrapped before use. ` +
        `Use a pattern block with some(x)/none arms, or the ?? operator.`,
      at
    )
  },

  // ?? left-hand side must be optional
  leftOfCoalesceIsOptional(type, at) {
    must(
      core.isOptional(type),
      `Left side of ?? must be an optional type, got '${typeDesc(type)}'.`,
      at
    )
  },

  // ── Pattern block rules ────────────────────────────────────────────────────

  wildcardIsLast(arms, at) {
    const wildcardIdx = arms.findIndex((a) => a.pattern.kind === "WildcardPattern")
    if (wildcardIdx !== -1) {
      must(
        wildcardIdx === arms.length - 1,
        `Unreachable arm: the wildcard '_' must be the last arm in a pattern block.`,
        at
      )
    }
  },

  blockIsExhaustive(arms, at) {
    const hasWildcard = arms.some((a) => a.pattern.kind === "WildcardPattern")
    const hasNone = arms.some((a) => a.pattern.kind === "NonePattern")
    const hasSome = arms.some((a) => a.pattern.kind === "SomePattern")
    // A block is exhaustive if it has _ OR it covers both some+none (optional handling)
    must(
      hasWildcard || (hasNone && hasSome),
      `Non-exhaustive pattern block: add a wildcard '_' arm to handle unmatched values.`,
      at
    )
  },

  noDuplicateFieldsInPattern(fields, at) {
    const names = fields.map((f) => f.field)
    const seen = new Set()
    for (const name of names) {
      must(!seen.has(name), `Duplicate field '${name}' in object pattern.`, at)
      seen.add(name)
    }
  },

  guardIsBool(type, at) {
    must(type === core.boolType, `Guard condition must be Bool, got '${type}'.`, at)
  },

  dropOnlyInFilterOrMap(stageName, at) {
    const allowed = ["filter", "map", "each"]
    must(
      stageName == null || allowed.includes(stageName),
      `'drop' can only be used inside a filter, map, or each stage.`,
      at
    )
  },

  haveSameType(t1, t2, at) {
    must(
      typeDesc(t1) === typeDesc(t2),
      `Type mismatch: '${typeDesc(t1)}' vs '${typeDesc(t2)}'.`,
      at
    )
  },

  haveNumericType(type, at) {
    must(
      type === core.intType || type === core.floatType,
      `Expected a numeric type (Int or Float), got '${type}'.`,
      at
    )
  },

  haveBoolType(type, at) {
    must(type === core.boolType, `Expected Bool, got '${type}'.`, at)
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeDesc(type) {
  if (typeof type === "string") return type
  return `${typeDesc(type.baseType)}?`  // must be OptionalType
}

// Map type names (from patterns) to actual types
function getTypeFromName(typeName) {
  const typeMap = {
    "int": core.intType,
    "string": core.stringType,
    "bool": core.boolType,
  }
  return typeMap[typeName] ?? core.anyType
}

// Extract all variables from a pattern and add them to context
function addPatternVariablesToContext(pattern, ctx) {

  // Type patterns: int(n), string(s), etc. - add the variable with the correct type
  if (pattern.kind === "TypePattern") {
    const bindingType = getTypeFromName(pattern.typeName)
    ctx.add(pattern.binding, { kind: "PatternVariable", type: bindingType })
  }
  // Some pattern: some(x) - add the variable
  else if (pattern.kind === "SomePattern") {
    ctx.add(pattern.binding, { kind: "PatternVariable", type: core.anyType })
  }
  // Single list pattern: [x] - add the variable
  else if (pattern.kind === "SingleListPattern") {
    ctx.add(pattern.binding, { kind: "PatternVariable", type: core.anyType })
  }
  // Head-tail pattern: [head, ...tail] - add both variables
  else if (pattern.kind === "HeadTailPattern") {
    ctx.add(pattern.head, { kind: "PatternVariable", type: core.anyType })
    ctx.add(pattern.tail, { kind: "PatternVariable", type: core.listType })
  }
  // Object pattern: { name: n, age: a } - add all bound variables
  else if (pattern.kind === "ObjectPattern") {
    if (pattern.fields) {
      for (const field of pattern.fields) {
        if (field.binding) {
          ctx.add(field.binding, { kind: "PatternVariable", type: core.anyType })
        }
      }
    }
  }
}

// ── Analyzer ──────────────────────────────────────────────────────────────────

// Tracks the name of the current named pipe stage so drop() can validate Rule 13.
let currentStageName = null

export default function analyze(match) {
  let context = Context.root()

  const builder = match.matcher.grammar.createSemantics().addOperation("rep", {
    // ── Program ──────────────────────────────────────────────────────────────
    Program(statements) {
      return core.program(statements.children.map((s) => s.rep()))
    },

    // ── Declarations ─────────────────────────────────────────────────────────
    LetDecl(_let, id, _colon, typeAnnot, _eq, pipeline, _semi) {
      must.notAlreadyDeclared(context, id.sourceString, { at: id })

      // Resolve the declared type annotation if present
      const declaredType = typeAnnot.children.length > 0
        ? typeAnnot.children[0].rep()
        : null  // unannotated → we'll infer from initializer, default Any

      const init = pipeline.rep()

      // Rule 1: none can only be assigned to an optional type
      // Check if the pipeline's source is a NoneLiteral
      if (init?.source?.kind === "NoneLiteral") {
        if (declaredType === null) {
          must(
            false,
            `Cannot assign 'none' without an explicit optional type annotation. ` +
              `Use 'let ${id.sourceString}: SomeType? = none'.`,
            { at: id }
          )
        }
        must.noneOnlyInOptionalContext(declaredType, { at: id })
      }

      const resolvedType = declaredType ?? init?.type ?? core.anyType
      const v = core.variable(id.sourceString, resolvedType)
      context.add(id.sourceString, v)
      return core.letDeclaration(v, init)
    },

    PipelineDecl(_pipeline, id, _colon, pipeType, _eq, pipeline, _semi) {
      must.notAlreadyDeclared(context, id.sourceString, { at: id })
      const type = pipeType.children.length > 0 ? pipeType.children[0].rep() : null
      const p = pipeline.rep()
      const named = core.namedPipeline(id.sourceString, p, type)
      context.add(id.sourceString, named)
      return core.pipelineDeclaration(named)
    },

    ExprStmt(pipeline, _semi) {
      return pipeline.rep()
    },

    // ── Pipeline ─────────────────────────────────────────────────────────────
    Pipeline(expr, _pipes, stages) {
      const source = expr.rep()
      const stageNodes = stages.children.map((s) => s.rep())
      return core.pipeline(source, stageNodes)
    },

    // ── Pipe Stages ───────────────────────────────────────────────────────────
    PipeStage_llm(_llm, _lp, args, _rp) {
      const argNodes = args.asIteration().children.map((a) => a.rep())
      // Ensure 'model' argument is present
      must(
        argNodes.some((a) => a.key === "model"),
        `llm() requires a 'model' argument.`,
        { at: _llm }
      )
      return core.llmStage(argNodes)
    },

    PipeStage_namedStage(id, block) {
      const name = id.sourceString
      const entity = context.lookup(name)
      // Allow known built-in stages or declared named pipelines
      must(
        entity != null,
        `'${name}' is not declared.`,
        { at: id }
      )
      // Thread stage name for Rule 13 (drop validation)
      const prevStageName = currentStageName
      currentStageName = name
      const blockNode = block.rep()
      currentStageName = prevStageName
      return core.namedStage(name, blockNode)
    },

    PipeStage_anonStage(block) {
      return core.anonStage(block.rep())
    },

    PipeStage_call(id, _lp, args, _rp) {
      const name = id.sourceString
      must(context.lookup(name) != null, `'${name}' is not declared.`, { at: id })
      return core.callStage(name, args.asIteration().children.map((a) => a.rep()))
    },

    PipeStage_ref(id) {
      const name = id.sourceString
      must(context.lookup(name) != null, `'${name}' is not declared.`, { at: id })
      return core.refStage(name)
    },

    LLMArg(key, _colon, value) {
      // value can be either strlit or id, both of which we want as strings
      return { key: key.sourceString, value: value.sourceString }
    },

    // ── Pattern Blocks ────────────────────────────────────────────────────────
    PatternBlock(_open, arms, _close) {
      const armNodes = arms.children.map((a) => a.rep())
      must.wildcardIsLast(armNodes, { at: _open })
      must.blockIsExhaustive(armNodes, { at: _open })
      return core.patternBlock(armNodes)
    },

    MatchArm(pattern, ifPart, exprPart, _arrow, body) {
      const p = pattern.rep()

      // Create a new scope for pattern variables
      const armContext = context.newChildContext()
      const oldContext = context
      context = armContext

      // Add pattern variables to scope
      addPatternVariablesToContext(p, context)

      // Now analyze guard and body in this scope
      let g = null
      if (exprPart.children && exprPart.children.length > 0) {
        g = exprPart.children[0].rep()
        must.guardIsBool(g.type, { at: ifPart.children[0] })
      }
      const b = body.rep()

      // Restore old context
      context = oldContext

      return core.matchArm(p, g, b)
    },

    ArmBody(node) {
      return node.rep()
    },

    // ── Patterns ──────────────────────────────────────────────────────────────
    Pattern_some(_some, _lp, id, _rp) {
      return core.somePattern(id.sourceString)
    },

    Pattern_none(_none) {
      return core.nonePattern
    },

    Pattern_typed(typePat, _lp, id, _rp) {
      return core.typePattern(typePat.sourceString.trim(), id.sourceString)
    },

    Pattern_emptyList(_lb, _rb) {
      return core.emptyListPattern()
    },

    Pattern_singleList(_lb, id, _rb) {
      return core.singleListPattern(id.sourceString)
    },

    Pattern_headTail(_lb, head, _comma, _dots, tail, _rb) {
      return core.headTailPattern(head.sourceString, tail.sourceString)
    },

    Pattern_object(_lb, fields, _rb) {
      const fieldNodes = fields.asIteration().children.map((f) => f.rep())
      must.noDuplicateFieldsInPattern(fieldNodes, { at: _lb })
      return core.objectPattern(fieldNodes)
    },

    Pattern_strLit(s) {
      return core.literalPattern(s.rep())
    },

    Pattern_floatLit(f) {
      return core.literalPattern(f.rep())
    },

    Pattern_intLit(i) {
      return core.literalPattern(i.rep())
    },

    Pattern_boolLit(b) {
      return core.literalPattern(b.rep())
    },

    Pattern_wildcard(_) {
      return core.wildcardPattern
    },

    FieldPat_bound(field, _colon, binding) {
      return core.fieldPattern(field.sourceString, binding.sourceString)
    },

    FieldPat_shorthand(id) {
      return core.fieldPattern(id.sourceString, id.sourceString)
    },

    // ── Type Annotations ──────────────────────────────────────────────────────
    TypeAnnot_optional(primType, _q) {
      return core.optionalType(primType.sourceString)
    },

    TypeAnnot_required(primType) {
      return primType.sourceString
    },

    PipelineType(from, _arrow, to) {
      return { kind: "PipelineType", from: from.rep(), to: to.rep() }
    },

    // ── Expressions ───────────────────────────────────────────────────────────
    Expr_coalesce(left, _op, right) {
      const l = left.rep()
      const r = right.rep()
      // Rule 3: left side of ?? must be optional
      must.leftOfCoalesceIsOptional(l.type, { at: _op })
      const resultType = l.type.baseType
      return core.coalesce(l, r, resultType)
    },

    Expr0_or(left, _op, right) {
      const l = left.rep()
      const r = right.rep()
      must.haveBoolType(l.type, { at: _op })
      must.haveBoolType(r.type, { at: _op })
      return core.binary("||", l, r, core.boolType)
    },

    Expr1_and(left, _op, right) {
      const l = left.rep()
      const r = right.rep()
      must.haveBoolType(l.type, { at: _op })
      must.haveBoolType(r.type, { at: _op })
      return core.binary("&&", l, r, core.boolType)
    },

    Expr2_eq(left, op, right) {
      const l = left.rep()
      const r = right.rep()
      must.haveSameType(l.type, r.type, { at: op })
      return core.binary(op.sourceString, l, r, core.boolType)
    },

    Expr3_compare(left, op, right) {
      const l = left.rep()
      const r = right.rep()
      return core.binary(op.sourceString, l, r, core.boolType)
    },

    Expr4_add(left, op, right) {
      const l = left.rep()
      const r = right.rep()
      return core.binary(op.sourceString, l, r, l.type)
    },

    Expr5_mul(left, op, right) {
      const l = left.rep()
      const r = right.rep()
      must.haveNumericType(l.type, { at: op })
      return core.binary(op.sourceString, l, r, l.type)
    },

    Expr6_negate(_op, expr) {
      const e = expr.rep()
      must.haveNumericType(e.type, { at: _op })
      return core.unary("-", e, e.type)
    },

    Expr6_not(_op, expr) {
      const e = expr.rep()
      must.haveBoolType(e.type, { at: _op })
      return core.unary("!", e, core.boolType)
    },

    Expr7_methodCall(obj, _dot, id, _lp, args, _rp) {
      const o = obj.rep()
      // Rule 4: cannot call methods on optional without unwrapping
      must.notOptionalWithoutUnwrap(o.type, { at: id })
      return core.methodCall(o, id.sourceString, args.asIteration().children.map((a) => a.rep()), core.anyType)
    },

    Expr7_member(obj, _dot, id) {
      const o = obj.rep()
      must.notOptionalWithoutUnwrap(o.type, { at: id })
      return core.memberAccess(o, id.sourceString, core.anyType)
    },

    // ── Primary ───────────────────────────────────────────────────────────────
    Primary_parens(_lp, expr, _rp) {
      return expr.rep()
    },

    Primary_list(_lb, exprs, _rb) {
      return core.listLiteral(exprs.asIteration().children.map((e) => e.rep()))
    },

    Primary_object(_lb, fields, _rb) {
      return core.objectLiteral(fields.asIteration().children.map((f) => f.rep()))
    },

    Primary_llm(_llm, _lp, args, _rp) {
      const argNodes = args.asIteration().children.map((a) => a.rep())
      must(
        argNodes.some((a) => a.key === "model"),
        `llm() requires a 'model' argument.`,
        { at: _llm }
      )
      return core.llmExpression(argNodes)
    },

    Primary_none(_none) {
      // Rule 1: none in an expression context — type will be checked by the
      // enclosing declaration or assignment. We return a NoneLiteral node
      // and let the parent node enforce the optional-type context.
      return core.noneLiteral
    },

    Primary_call(id, _lp, args, _rp) {
      const name = id.sourceString
      const entity = context.lookup(name)
      must.haveBeenDeclared(entity, name, { at: id })
      return core.functionCall(name, args.asIteration().children.map((a) => a.rep()), core.anyType)
    },

    Primary_id(id) {
      const name = id.sourceString
      const entity = context.lookup(name)
      must.haveBeenDeclared(entity, name, { at: id })
      // Return the entity itself so its type is available
      return entity
    },

    ObjField(id, _colon, expr) {
      return { key: id.sourceString, value: expr.rep() }
    },

    // ── Literals ──────────────────────────────────────────────────────────────
    intlit(_digits, _maybeN) {
      return BigInt(this.sourceString.replace(/n$/, ""))
    },

    floatlit(_whole, _dot, _frac, _e, _sign, _exp) {
      return Number(this.sourceString)
    },

    strlit(_open, _chars, _close) {
      return this.sourceString
    },

    boollit(_val) {
      return this.sourceString === "true"
    },

    // Rule 13: drop is only valid inside filter, map, or each
    drop(_kw) {
      must.dropOnlyInFilterOrMap(currentStageName, { at: _kw })
      return core.dropAction
    },

  })

  return builder(match).rep()
}