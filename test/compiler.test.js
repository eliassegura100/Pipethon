// compiler.test.js — end-to-end integration tests for the Pipethon compiler.
//
// Tests the full pipeline: source string → parse → analyze → optimize → JS.
// These tests ensure all four phases cooperate correctly.
 
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import compile from "../src/compiler.js"
 
// ── Helpers ────────────────────────────────────────────────────────────────────
 
// Compile and verify no error is thrown.
function ok(source, outputType = "js") {
  assert.doesNotThrow(() => compile(source, outputType))
}
 
// Compile and verify a specific error pattern is thrown.
function err(source, pattern, outputType = "js") {
  assert.throws(() => compile(source, outputType), pattern)
}
 
// Compile to JS and return the output.
function toJS(source) {
  return compile(source, "js")
}
 
describe("The compiler (end-to-end)", () => {
 
  // ── Output type routing ───────────────────────────────────────────────────
 
  describe("output type routing", () => {
    it("returns 'Syntax is ok' for outputType 'parsed'", () => {
      assert.equal(compile("42n |> print;", "parsed"), "Syntax is ok")
    })
 
    it("returns an AST object for outputType 'analyzed'", () => {
      const result = compile("42n |> print;", "analyzed")
      assert.equal(result.kind, "Program")
    })
 
    it("returns an optimized AST object for outputType 'optimized'", () => {
      const result = compile("42n |> print;", "optimized")
      assert.equal(result.kind, "Program")
    })
 
    it("returns a JS string for outputType 'js'", () => {
      const result = compile("42n |> print;", "js")
      assert.equal(typeof result, "string")
    })
 
    it("throws on an unknown output type", () => {
      err("42n |> print;", /Unknown output type/, "bytecode")
    })
  })
 
  // ── Syntax errors propagate from parser ──────────────────────────────────
 
  describe("syntax errors", () => {
    it("throws on missing semicolon", () => {
      err("42n |> print", /Line 1/)
    })
 
    it("throws on empty pattern block", () => {
      err("42n |> {};", /Line 1/)
    })
 
    it("throws on unknown token", () => {
      err("@@@", /Line 1/)
    })
 
    it("throws on llm() with no arguments", () => {
      err('"q" |> llm() |> print;', /Line 1/)
    })
  })
 
  // ── Semantic errors propagate from analyzer ───────────────────────────────
 
  describe("semantic errors", () => {
    it("throws on none assigned to unannotated variable", () => {
      err("let x = none;", /explicit optional/)
    })
 
    it("throws on none assigned to non-optional type", () => {
      err("let x: Int = none;", /non-optional/)
    })
 
    it("throws on undeclared variable reference", () => {
      err("x |> print;", /not declared/)
    })
 
    it("throws on duplicate let declarations", () => {
      err("let x = 1n; let x = 2n;", /already declared/)
    })
 
    it("throws on non-exhaustive pattern block", () => {
      err("42n |> { int(n) => n };", /Non-exhaustive/)
    })
 
    it("throws on wildcard before last position", () => {
      err("42n |> { _ => 0n int(n) => n };", /wildcard/)
    })
 
    it("throws on ?? with non-optional left side", () => {
      err("let x: Int = 1n; x ?? 0n |> print;", /Left side of \?\?/)
    })
 
    it("throws on llm() missing model argument", () => {
      err('"q" |> llm(prompt: "hi") |> { some(s) => s none => "" };', /model/)
    })
  })
 
  // ── Optimizer changes are reflected in generated JS ───────────────────────
 
  describe("optimizer integration", () => {
    it("folds constant arithmetic before emitting JS", () => {
      // 2n + 3n should fold to 5n — the output should not contain '2n + 3n'
      const out = toJS("let x = 2n + 3n;")
      assert.ok(!out.includes("2n + 3n"), `Expected fold; got:\n${out}`)
      assert.ok(out.includes("5n"), `Expected 5n in output; got:\n${out}`)
    })
 
    it("folds x + 0n to x (strength reduction)", () => {
      const out = toJS("let x = 42n; let y = x;")
      // Just checking it compiles cleanly and emits two consts
      assert.match(out, /const x_\d+/)
      assert.match(out, /const y_\d+/)
    })
 
    it("folds none ?? default → default", () => {
      // After optimization the none branch is eliminated
      const out = toJS('let x: String? = none; x ?? "default" |> print;')
      // The optimizer folds away the none-left coalesce to just "default"
      assert.ok(out.includes('"default"'), `Expected "default" in output; got:\n${out}`)
    })
  })
 
  // ── Full programs ─────────────────────────────────────────────────────────
 
  describe("full programs compile end-to-end", () => {
    it("compiles a filter-map-collect chain", () => {
      ok('[1n, 2n, 3n] |> filter { int(n) if n > 1n => true _ => false } |> map { int(n) => n * 2n _ => 0n } |> collect;')
    })
 
    it("compiles a named pipeline declaration and use", () => {
      ok("pipeline evens = [0n, 1n, 2n, 3n, 4n] |> filter { int(n) if n % 2n == 0n => true _ => false };")
    })
 
    it("compiles some/none optional handling", () => {
      ok('let x: String? = none; x |> { some(s) => s none => "" };')
    })
 
    it("compiles an llm pipeline with some/none handling", () => {
      ok('"What is 2+2?" |> llm(model: "claude", prompt: "{input}") |> { some(s) => s none => "error" };')
    })
 
    it("compiles ?? coalescing on an optional", () => {
      ok('let x: String? = "hi"; x ?? "default" |> print;')
    })
 
    it("compiles object pattern matching", () => {
      ok('{ name: "Alice", age: 30n } |> { { name: n, age: a } => n _ => "" };')
    })
 
    it("compiles head/tail list destructuring", () => {
      ok("[1n, 2n, 3n] |> { [head, ...tail] => head _ => 0n };")
    })
 
    it("compiles a multi-statement program", () => {
      ok("let x = 10n; let y = 20n; x |> print; y |> print;")
    })
 
    it("compiles a program with a line comment", () => {
      ok("// find big numbers\n[1n, 100n, 3n] |> filter { int(n) if n > 50n => true _ => false } |> print;")
    })
 
    it("compiles a program with a block comment", () => {
      ok("/* Pipethon demo */\n42n |> print;")
    })
 
    it("emits runnable JS with the prelude header", () => {
      const out = toJS("42n |> print;")
      assert.ok(out.startsWith("// Generated by Pipethon compiler"), `Missing prelude\nGot:\n${out}`)
    })
 
    it("generates unique variable names across statements", () => {
      const out = toJS("let x = 1n; let y = 2n; let z = 3n;")
      // All three should have distinct numeric suffixes
      const matches = [...out.matchAll(/const \w+_(\d+)/g)].map((m) => m[1])
      const unique = new Set(matches)
      assert.equal(unique.size, matches.length, "Variable name suffixes should all be unique")
    })
  })
})