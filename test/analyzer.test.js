// analyzer.test.js — semantic analysis tests for Pipethon.
// Tests that well-formed programs analyze without error, and that programs
// violating the 13 static rules produce the correct error messages.

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

function ok(source) {
  assert.doesNotThrow(() => analyze(parse(source)))
}

function err(source, pattern) {
  assert.throws(() => analyze(parse(source)), pattern)
}

describe("The analyzer", () => {

  // ── Programs that should analyze without error ─────────────────────────────

  describe("accepts valid programs", () => {
    it("accepts a simple int pipeline", () => {
      ok("42n |> print;")
    })

    it("accepts an untyped let binding (defaults to Any, non-nullable)", () => {
      ok("let x = 42n;")
    })

    it("accepts a typed Int let binding", () => {
      ok("let x: Int = 42n;")
    })

    it("accepts a typed String let binding", () => {
      ok('let x: String = "hello";')
    })

    it("accepts a typed Bool let binding", () => {
      ok("let x: Bool = true;")
    })

    it("accepts a typed optional binding assigned none", () => {
      ok("let x: String? = none;")
    })

    it("accepts a typed optional binding assigned a value", () => {
      ok('let x: String? = "hello";')
    })

    it("accepts a variable reference after its declaration", () => {
      ok("let x = 42n; x |> print;")
    })

    it("accepts a filter pipeline with type pattern and guard", () => {
      ok("[1n, 2n, 3n] |> filter { int(n) if n > 1n => true _ => false };")
    })

    it("accepts a map pipeline with type pattern", () => {
      ok("[1n, 2n, 3n] |> map { int(n) => n * 2n _ => 0n };")
    })

    it("accepts some/none arm pair as exhaustive coverage", () => {
      ok('let x: String? = none; x |> { some(s) => s none => "" };')
    })

    it("accepts ?? on an explicitly optional variable", () => {
      ok('let x: String? = none; x ?? "default" |> print;')
    })

    it("accepts a named pipeline declaration without type", () => {
      ok("pipeline doubles = [1n, 2n] |> map { int(n) => n * 2n _ => 0n };")
    })

    it("accepts a named pipeline with a pipeline type annotation", () => {
      ok("pipeline pos: Any -> Any = [1n] |> filter { int(n) if n > 0n => true _ => false };")
    })

    it("resolves from/to types in a pipeline type annotation", () => {
      ok("pipeline echo: Any -> Any = 42n |> print;")
    })

    it("accepts llm() as a pipe stage with model and prompt", () => {
      ok('"hello" |> llm(model: "claude", prompt: "{input}") |> { some(s) => s none => "" };')
    })

    it("accepts llm() expression in a match arm body", () => {
      ok('"q" |> { string(s) => llm(model: "claude", prompt: "{input}") _ => none };')
    })

    it("accepts method call on a non-optional value", () => {
      ok('"hello" |> { string(s) => s.uppercase() _ => "" };')
    })

    it("accepts arithmetic in a let binding", () => {
      ok("let x = 2n * 3n + 4n;")
    })

    it("accepts float arithmetic in a let binding", () => {
      ok("let x = 1.5 * 2.0;")
    })

    it("accepts logical not on a bool", () => {
      ok("let x = !true;")
    })

    it("accepts negation of an int literal", () => {
      ok("let x = -5n;")
    })

    it("accepts an object literal with a destructuring pattern", () => {
      ok('{ name: "Alice" } |> { { name: n } => n _ => "" };')
    })

    it("accepts a head/tail list pattern", () => {
      ok("[1n, 2n, 3n] |> { [head, ...tail] => head _ => 0n };")
    })

    it("accepts an empty list pattern", () => {
      ok("[] |> { [] => true _ => false };")
    })

    it("accepts a bool literal pattern", () => {
      ok("true |> { true => 1n _ => 0n };")
    })

    it("accepts an int literal pattern", () => {
      ok('42n |> { 42n => "yes" _ => "no" };')
    })

    it("accepts multiple sequential let statements", () => {
      ok("let x = 1n; let y = 2n; x |> print;")
    })

    it("accepts a full three-stage pipeline ending in collect", () => {
      ok("[1n, 2n, 3n] |> map { int(n) => n * 2n _ => 0n } |> collect;")
    })

    it("accepts object pattern with field shorthand", () => {
      ok('{ name: "Bob" } |> { { name } => name _ => "" };')
    })

    it("accepts a list literal flowing to print", () => {
      ok("[1n, 2n, 3n] |> print;")
    })

    it("accepts a string literal flowing through a string pattern", () => {
      ok('"yes" |> { "yes" => true _ => false };')
    })

    it("accepts guard with && compound condition", () => {
      ok("[1n, 5n, 10n] |> filter { int(n) if n > 2n && n < 8n => true _ => false };")
    })

    it("accepts a float literal pattern", () => {
      ok("3.14 |> { 3.14 => true _ => false };")
    })

    it("accepts a logical || in a guard condition", () => {
      ok("[1n] |> filter { int(n) if n > 0n || n < 10n => true _ => false };")
    })

    it("accepts a parenthesized expression", () => {
      ok("(42n) |> print;")
    })

    it("accepts drop as an arm body inside a filter stage", () => {
      ok("[1n, 2n] |> filter { int(n) if n > 1n => drop _ => true };")
    })
  })

  // ── Rule 1: none only in optional context ─────────────────────────────────

  describe("Rule 1 — none can only be assigned to an explicit optional type", () => {
    it("rejects none with no type annotation (would introduce null unsafety)", () => {
      err("let x = none;", /explicit optional/)
    })

    it("rejects none assigned to a required Int", () => {
      err("let x: Int = none;", /non-optional/)
    })

    it("rejects none assigned to a required String", () => {
      err('let x: String = none;', /non-optional/)
    })

    it("rejects none assigned to a required Bool", () => {
      err("let x: Bool = none;", /non-optional/)
    })
  })

  // ── Rule 3: ?? requires optional left operand ─────────────────────────────

  describe("Rule 3 — left side of ?? must be optional", () => {
    it("rejects ?? on a non-optional Int variable", () => {
      err("let x: Int = 42n; x ?? 0n |> print;", /Left side of \?\? must be an optional/)
    })

    it("rejects ?? on a string literal", () => {
      err('"hello" ?? "default" |> print;', /Left side of \?\? must be an optional/)
    })

    it("rejects ?? on a bool literal", () => {
      err("true ?? false |> print;", /Left side of \?\? must be an optional/)
    })
  })

  // ── Rule 6: non-exhaustive pattern blocks ─────────────────────────────────

  describe("Rule 6 — pattern blocks must be exhaustive", () => {
    it("rejects a single type-pattern arm with no wildcard", () => {
      err("42n |> { int(n) => n };", /Non-exhaustive/)
    })

    it("rejects a map block with only one arm and no wildcard", () => {
      err("[1n] |> map { int(n) => n * 2n };", /Non-exhaustive/)
    })

    it("rejects a block with only a guard arm and no fallback", () => {
      err("[1n] |> filter { int(n) if n > 0n => true };", /Non-exhaustive/)
    })
  })

  // ── Rule 7: wildcard must be the last arm ─────────────────────────────────

  describe("Rule 7 — wildcard _ must be the last arm", () => {
    it("rejects a wildcard arm followed by another arm", () => {
      err('42n |> { _ => 0n int(n) => n };', /wildcard/)
    })
  })

  // ── Rule 10: no duplicate field names in object patterns ──────────────────

  describe("Rule 10 — no duplicate fields in object patterns", () => {
    it("rejects the same field name twice in one object pattern", () => {
      err('{ name: "Alice" } |> { { name: a, name: b } => a _ => "" };', /Duplicate field/)
    })
  })

  // ── Rule 11: variables must be declared before use ────────────────────────

  describe("Rule 11 — undeclared variable references", () => {
    it("rejects a reference to a never-declared variable", () => {
      err("x |> print;", /not declared/)
    })

    it("rejects a variable used before its declaration", () => {
      err("x |> print; let x = 1n;", /not declared/)
    })

    it("rejects an undeclared named pipe stage", () => {
      err("[1n] |> myPipeline;", /not declared/)
    })
  })

  // ── Rule 12: no duplicate declarations in the same scope ─────────────────

  describe("Rule 12 — duplicate declarations", () => {
    it("rejects two let bindings with the same name", () => {
      err("let x = 1n; let x = 2n;", /already declared/)
    })

    it("rejects a let and a pipeline declaration sharing a name", () => {
      err(
        "let doubles = 42n; pipeline doubles = [1n] |> map { int(n) => n _ => 0n };",
        /already declared/
      )
    })
  })

  // ── llm() argument validation ─────────────────────────────────────────────

  describe("llm() requires model argument", () => {
    it("rejects llm() with no arguments at all", () => {
      // llm() with no args is a syntax error (caught by parser), so test minimal case:
      err('"q" |> llm(prompt: "Answer: {input}") |> { some(s) => s none => "" };', /model/)
    })

    it("accepts llm() with both model and prompt", () => {
      ok('"q" |> llm(model: "gpt-4", prompt: "Answer: {input}") |> { some(s) => s none => "" };')
    })

    it("accepts llm() expression with model and format", () => {
      ok('"data" |> llm(model: "claude", prompt: "Extract: {input}", format: json) |> { some(s) => s none => "" };')
    })
  })

  // ── Rule 13: drop only inside filter / map / each ─────────────────────────

  describe("Rule 13 — drop is only valid in filter, map, or each", () => {
    it("rejects drop used inside a split stage", () => {
      err("[1n] |> split { int(n) => drop _ => 0n };", /can only be used inside/)
    })

    it("rejects drop used inside a match stage", () => {
      err("42n |> match { int(n) => drop _ => 0n };", /can only be used inside/)
    })
  })

  // ── == type checking ──────────────────────────────────────────────────────

  describe("== operator type checking", () => {
    it("rejects == between Int and String variables", () => {
      err('let n: Int = 1n; let s: String = "hi"; n == s;', /Type mismatch/)
    })

    it("rejects == between optional variables of different base types", () => {
      err("let x: String? = none; let y: Int? = none; x == y;", /Type mismatch/)
    })
  })
})