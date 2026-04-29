// optimizer.test.js — AST-level optimization tests for Pipethon.
//
// Tests drive the optimizer directly with core.js nodes so we get precise
// control over inputs and can assert exact output values/structures.
// No parsing or analysis is involved.
 
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import optimize from "../src/optimizer.js"
import * as core from "../src/core.js"
 
// Shorthand: run optimizer and check the result equals `expected`
function folds(node, expected) {
  assert.deepEqual(optimize(node), expected)
}
 
// Run optimizer and check the result is the same object (no fold occurred)
function unchanged(node) {
  assert.equal(optimize(node), node)
}
 
describe("The optimizer", () => {
 
  // ── Constant folding — BigInt arithmetic ──────────────────────────────────
 
  describe("constant folds BigInt arithmetic", () => {
    it("folds 3n + 4n → 7n", () => {
      folds(core.binary("+", 3n, 4n, core.intType), 7n)
    })
 
    it("folds 10n - 3n → 7n", () => {
      folds(core.binary("-", 10n, 3n, core.intType), 7n)
    })
 
    it("folds 6n * 7n → 42n", () => {
      folds(core.binary("*", 6n, 7n, core.intType), 42n)
    })
 
    it("folds 20n / 4n → 5n", () => {
      folds(core.binary("/", 20n, 4n, core.intType), 5n)
    })
 
    it("folds 10n % 3n → 1n", () => {
      folds(core.binary("%", 10n, 3n, core.intType), 1n)
    })
 
    it("folds 2n ** 10n → 1024n", () => {
      folds(core.binary("**", 2n, 10n, core.intType), 1024n)
    })
  })
 
  // ── Constant folding — Float arithmetic ───────────────────────────────────
 
  describe("constant folds Float arithmetic", () => {
    it("folds 1.5 + 2.5 → 4.0", () => {
      folds(core.binary("+", 1.5, 2.5, core.floatType), 4.0)
    })
 
    it("folds 3.0 * 2.0 → 6.0", () => {
      folds(core.binary("*", 3.0, 2.0, core.floatType), 6.0)
    })
  })
 
  // ── Constant folding — comparison operators ───────────────────────────────
 
  describe("constant folds comparisons", () => {
    it("folds 5n > 3n → true", () => {
      folds(core.binary(">", 5n, 3n, core.boolType), true)
    })
 
    it("folds 3n > 5n → false", () => {
      folds(core.binary(">", 3n, 5n, core.boolType), false)
    })
 
    it("folds 3n == 3n → true", () => {
      folds(core.binary("==", 3n, 3n, core.boolType), true)
    })
 
    it("folds 3n != 4n → true", () => {
      folds(core.binary("!=", 3n, 4n, core.boolType), true)
    })
 
    it("folds 2n <= 2n → true", () => {
      folds(core.binary("<=", 2n, 2n, core.boolType), true)
    })
 
    it("folds 5n >= 6n → false", () => {
      folds(core.binary(">=", 5n, 6n, core.boolType), false)
    })
  })
 
  // ── Strength reductions — left operand ───────────────────────────────────
 
  describe("strength reductions (left operand is constant)", () => {
    const x = core.variable("x", core.intType)
 
    it("folds 0n + x → x", () => {
      assert.equal(optimize(core.binary("+", 0n, x, core.intType)), x)
    })
 
    it("folds 1n * x → x", () => {
      assert.equal(optimize(core.binary("*", 1n, x, core.intType)), x)
    })
 
    it("folds 0n * x → 0n", () => {
      folds(core.binary("*", 0n, x, core.intType), 0n)
    })
 
    it("folds 0n / x → 0n", () => {
      folds(core.binary("/", 0n, x, core.intType), 0n)
    })
  })
 
  // ── Strength reductions — right operand ──────────────────────────────────
 
  describe("strength reductions (right operand is constant)", () => {
    const x = core.variable("x", core.intType)
 
    it("folds x + 0n → x", () => {
      assert.equal(optimize(core.binary("+", x, 0n, core.intType)), x)
    })
 
    it("folds x - 0n → x", () => {
      assert.equal(optimize(core.binary("-", x, 0n, core.intType)), x)
    })
 
    it("folds x * 1n → x", () => {
      assert.equal(optimize(core.binary("*", x, 1n, core.intType)), x)
    })
 
    it("folds x / 1n → x", () => {
      assert.equal(optimize(core.binary("/", x, 1n, core.intType)), x)
    })
 
    it("folds x * 0n → 0n", () => {
      folds(core.binary("*", x, 0n, core.intType), 0n)
    })
 
    it("folds x ** 0n → 1", () => {
      folds(core.binary("**", x, 0n, core.intType), 1)
    })
  })
 
  // ── Boolean short-circuits ────────────────────────────────────────────────
 
  describe("boolean short-circuit simplification", () => {
    const t = true
    const f = false
    const b = core.variable("b", core.boolType)
 
    it("folds true && b → b", () => {
      assert.equal(optimize(core.binary("&&", t, b, core.boolType)), b)
    })
 
    it("folds b && true → b", () => {
      assert.equal(optimize(core.binary("&&", b, t, core.boolType)), b)
    })
 
    it("folds false && b → false", () => {
      folds(core.binary("&&", f, b, core.boolType), false)
    })
 
    it("folds b && false → false", () => {
      folds(core.binary("&&", b, f, core.boolType), false)
    })
 
    it("folds false || b → b", () => {
      assert.equal(optimize(core.binary("||", f, b, core.boolType)), b)
    })
 
    it("folds b || false → b", () => {
      assert.equal(optimize(core.binary("||", b, f, core.boolType)), b)
    })
 
    it("folds true || b → true", () => {
      folds(core.binary("||", t, b, core.boolType), true)
    })
 
    it("folds b || true → true", () => {
      folds(core.binary("||", b, t, core.boolType), true)
    })
  })
 
  // ── Unary expression folding ──────────────────────────────────────────────
 
  describe("unary expression folding", () => {
    it("folds -(5n) → -5n", () => {
      folds(core.unary("-", 5n, core.intType), -5n)
    })
 
    it("folds -(3.0) → -3.0", () => {
      folds(core.unary("-", 3.0, core.floatType), -3.0)
    })
 
    it("folds !true → false", () => {
      folds(core.unary("!", true, core.boolType), false)
    })
 
    it("folds !false → true", () => {
      folds(core.unary("!", false, core.boolType), true)
    })
 
    it("does not fold negation of a variable", () => {
      const x = core.variable("x", core.intType)
      const node = core.unary("-", x, core.intType)
      unchanged(node)
    })
  })
 
  // ── Coalesce folding ──────────────────────────────────────────────────────
 
  describe("coalesce folding", () => {
    it("folds none ?? default → default", () => {
      const def = "fallback"
      const node = core.coalesce(core.noneLiteral, def, core.stringType)
      assert.equal(optimize(node), def)
    })
 
    it("folds non-optional literal ?? default → literal (left wins)", () => {
      // A string literal has type stringType (non-optional), so it folds to left
      const node = core.coalesce("hello", "world", core.stringType)
      assert.equal(optimize(node), "hello")
    })
 
    it("preserves coalesce when left is an optional variable", () => {
      const x = core.variable("x", core.optionalType(core.stringType))
      const node = core.coalesce(x, "default", core.stringType)
      assert.equal(optimize(node), node)
    })
  })
 
  // ── Nested / recursive optimization ──────────────────────────────────────
 
  describe("recursive optimization through the AST", () => {
    it("folds nested arithmetic: (2n + 3n) * 4n → 20n", () => {
      const inner = core.binary("+", 2n, 3n, core.intType)   // folds to 5n
      const outer = core.binary("*", inner, 4n, core.intType) // folds to 20n
      folds(outer, 20n)
    })
 
    it("folds through a LetDeclaration initializer", () => {
      const v = core.variable("x", core.intType)
      const decl = core.letDeclaration(v, core.binary("+", 1n, 1n, core.intType))
      const result = optimize(decl)
      assert.equal(result.initializer, 2n)
    })
 
    it("folds through a ListLiteral's elements", () => {
      const list = core.listLiteral([
        core.binary("+", 1n, 2n, core.intType),
        core.binary("*", 3n, 3n, core.intType),
      ])
      const result = optimize(list)
      assert.deepEqual(result.elements, [3n, 9n])
    })
 
    it("folds inside a Pipeline source", () => {
      const pipe = core.pipeline(
        core.binary("+", 1n, 1n, core.intType),
        []
      )
      const result = optimize(pipe)
      assert.equal(result.source, 2n)
    })
  })
 
  // ── FunctionCall optimization ─────────────────────────────────────────────
 
  describe("optimizes FunctionCall arguments", () => {
    it("folds constant args inside a FunctionCall", () => {
      const call = core.functionCall("myFn", [core.binary("+", 1n, 2n, core.intType)], core.anyType)
      const result = optimize(call)
      assert.deepEqual(result.args, [3n])
    })
  })
 
  // ── Pass-throughs ─────────────────────────────────────────────────────────
 
  describe("passes through nodes it cannot optimize", () => {
    it("passes through a Variable node", () => {
      const x = core.variable("x", core.intType)
      unchanged(x)
    })
 
    it("passes through a NoneLiteral", () => {
      unchanged(core.noneLiteral)
    })
 
    it("passes through an LLMStage (opaque at compile time)", () => {
      const stage = core.llmStage([{ key: "model", value: "claude" }])
      unchanged(stage)
    })
 
    it("passes through an LLMExpression", () => {
      const expr = core.llmExpression([{ key: "model", value: "claude" }])
      unchanged(expr)
    })
  })
})
