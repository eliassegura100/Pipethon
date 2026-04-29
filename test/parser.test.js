// parser.test.js — syntax-only tests for the Pipethon parser.
// Tests that programs are syntactically valid OR that specific syntax errors
// are detected at the correct location.
 
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"
 
// Programs that should parse successfully
const syntaxChecks = [
  // ── Literals flowing through a pipeline ──────────────────────────────────
  ["integer literal statement",       "42 |> print;"],
  ["float literal statement",         "3.14 |> print;"],
  ["string literal statement",        '"hello" |> print;'],
  ["true literal statement",          "true |> print;"],
  ["false literal statement",         "false |> print;"],
  ["list literal statement",          "[1, 2, 3] |> print;"],
  ["object literal statement",        '{ name: "Alice", age: 30 } |> print;'],
  ["empty list literal",              "[] |> print;"],
 
  // ── Let declarations ──────────────────────────────────────────────────────
  ["untyped let binding",             "let x = 42;"],
  ["typed let Int binding",           "let x: Int = 42;"],
  ["typed let String binding",        'let x: String = "hello";'],
  ["typed let Bool binding",          "let x: Bool = true;"],
  ["typed optional binding",          "let x: String? = none;"],
  ["let binding to pipeline result",  "let result = [1, 2, 3] |> collect;"],
 
  // ── Named pipeline declarations ───────────────────────────────────────────
  ["named pipeline no type",          "pipeline doubles = [0n] |> map { int(n) => n * 2n _ => 0n };"],
  ["named pipeline with type",        "pipeline pos: Any -> Any = [0n] |> filter { int(n) if n > 0n => true _ => false };"],
 
  // ── Multi-stage pipelines ─────────────────────────────────────────────────
  ["two-stage pipeline",              '[1, 2, 3] |> filter { int(n) if n > 1n => true _ => false } |> print;'],
  ["three-stage pipeline",            '[1, 2, 3] |> map { int(n) => n * 2n } |> filter { int(n) if n > 2n => true _ => false } |> collect;'],
 
  // ── Pattern types ─────────────────────────────────────────────────────────
  ["int type pattern",                "42n |> { int(n) => n _ => 0n };"],
  ["float type pattern",              "3.14 |> { float(f) => f _ => 0.0 };"],
  ["string type pattern",             '"hi" |> { string(s) => s _ => "" };'],
  ["bool type pattern",               "true |> { bool(b) => b _ => false };"],
  ["list type pattern",               "[1] |> { list(xs) => xs _ => [] };"],
  ["none pattern",                    "let x: String? = none; x |> { some(s) => s none => \"\" };"],
  ["some pattern",                    "let x: String? = none; x |> { some(s) => s none => \"\" };"],
  ["wildcard pattern",                "42n |> { _ => true };"],
 
  // ── Literal patterns ──────────────────────────────────────────────────────
  ["integer literal pattern",         '42n |> { 42n => "yes" _ => "no" };'],
  ["string literal pattern",          '"yes" |> { "yes" => true _ => false };'],
  ["bool literal pattern true",       "true |> { true => 1n _ => 0n };"],
  ["bool literal pattern false",      "false |> { false => 0n _ => 1n };"],
 
  // ── Guard conditions ──────────────────────────────────────────────────────
  ["guard with int pattern",          "[1n, 2n, 3n] |> filter { int(n) if n > 1n => true _ => false };"],
  ["guard with string length",        '["hi", "hello"] |> filter { string(s) if s.length() > 2n => true _ => false };'],
  ["guard with && condition",         "[1n, 5n, 10n] |> filter { int(n) if n > 2n && n < 8n => true _ => false };"],
 
  // ── Object patterns ───────────────────────────────────────────────────────
  ["object pattern with bindings",    '{ name: "Alice" } |> { { name: n } => n _ => "" };'],
  ["object pattern shorthand",        '{ name: "Bob" } |> { { name } => name _ => "" };'],
  ["object pattern multi-field",      '{ name: "Alice", age: 30n } |> { { name: n, age: a } => n _ => "" };'],
  ["object pattern with guard",       '{ age: 20n } |> { { age: a } if a >= 18n => true _ => false };'],
 
  // ── List patterns ─────────────────────────────────────────────────────────
  ["empty list pattern",              "[] |> { [] => true _ => false };"],
  ["single element list pattern",     "[42n] |> { [x] => x _ => 0n };"],
  ["head and tail list pattern",      "[1n, 2n, 3n] |> { [head, ...tail] => head _ => 0n };"],
 
  // ── Null coalescing operator ──────────────────────────────────────────────
  ["coalesce with optional",          'let x: String? = none; x ?? "default" |> print;'],
 
  // ── LLM calls ─────────────────────────────────────────────────────────────
  ["llm as pipe stage",               '"hello" |> llm(model: "claude", prompt: "Answer: {input}") |> print;'],
  ["llm with format arg",             '"data" |> llm(model: "claude", prompt: "Extract: {input}", format: json) |> { some(s) => s none => "" };'],
  ["llm as expression in arm",        '"query" |> { string(s) => llm(model: "claude", prompt: "{input}") _ => none };'],
 
  // ── Arithmetic expressions ────────────────────────────────────────────────
  ["addition",                        "[1n, 2n] |> map { int(n) => n + 1n };"],
  ["multiplication",                  "[2n, 3n] |> map { int(n) => n * 2n };"],
  ["mixed arithmetic",                "let x = 2n * 3n + 4n;"],
  ["negation",                        "let x = -5n;"],
  ["logical not",                     "let x = !true;"],
  ["comparison operators",            "let x = 5n > 3n;"],
  ["equality operator",               "let x = 1n == 1n;"],
 
  // ── Method calls ──────────────────────────────────────────────────────────
  ["method call on string",           '"hello" |> { string(s) => s.uppercase() _ => "" };'],
  ["method call with args",           '"hello world" |> { string(s) => s.split(" ") _ => [] };'],
 
  // ── Comments ─────────────────────────────────────────────────────────────
  ["line comment",                    "// this is a comment\n42n |> print;"],
  ["block comment",                   "/* block\ncomment */\n42n |> print;"],
  ["inline comment",                  "[1n, 2n] |> map { int(n) => n * 2n } /* transform */ |> print;"],
 
  // ── Multiple statements ───────────────────────────────────────────────────
  ["multiple let declarations",       "let x = 1n; let y = 2n; x |> print;"],
  ["pipeline then declaration",       "[1n, 2n] |> print; let z = 3n;"],
]
 
// Programs with syntax errors the parser must detect
const syntaxErrors = [
  ["missing semicolon",              "42n |> print",                            /Line 1/],
  ["pipeline starts with |>",        "|> print;",                               /Line 1/],
  ["missing => in arm",              "42n |> { int(n) n * 2n };",              /Line 1/],
  ["unclosed pattern block",         "42n |> { int(n) => n * 2n ;",            /Line 1/],
  ["empty pattern block",            "42n |> {};",                              /Line 1/],
  ["tail without dots",              "[1n, 2n] |> { [h, t] => h _ => 0n };",  /Line 1/],
  ["let with no initializer",        "let x;",                                  /Line 1/],
  ["llm with no args",               '"q" |> llm() |> print;',                  /Line 1/],
  ["unknown token",                  "@@@",                                     /Line 1/],
  ["unclosed string",                '"hello |> print;',                        /Line 1/],
  ["pipeline type missing arrow",    "pipeline f: Int Int = map { int(n) => n _ => 0n };", /Line 1/],
]
 
describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`matches ${scenario}`, () => {
      assert(parse(source).succeeded())
    })
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => parse(source), errorMessagePattern)
    })
  }
})