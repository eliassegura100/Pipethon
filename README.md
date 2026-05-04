<img width="150" height="150" alt="Pipethon Logo copy" src="https://github.com/user-attachments/assets/901778fe-0c9c-469b-b897-c4d8cdeea65c" />

# Pipethon

**_Flow. Match. Think._**

Pipethon is a modern programming language built for the age of intelligent systems. Designed around two powerful primitives, **pipeline composition** and **pattern matching**, Pipethon gives developers a clean, expressive way to build AI-powered applications without the boilerplate, fragility, and complexity of traditional code.

In Pipethon, data flows. Every program is a series of transformations, each stage receiving the output of the last, reshaping it, routing it, or passing it to an AI model. There are no tangled callbacks, no deeply nested conditionals, no brittle string parsing. Just clear, readable pipelines that tell a story from input to output.

At every stage, Pipethon's pattern matching lets you describe what your data looks like and what should happen to it by type, by shape, by value, or by structure. When an AI model returns unpredictable output, pattern matching tames it. When a pipeline needs to branch, pattern matching routes it. When data needs to be validated, pattern matching guards it.

# Features

- Pipeline-first syntax — the |> operator is the primary composition primitive. Every program is a series of data transformations.
- Exhaustive pattern matching — { pattern => body ... } blocks must cover all cases. The analyzer rejects non-exhaustive matches at compile time.
- First-class optional types — String?, Int?, etc. Null is only legal when declared. Assigning none to a non-optional is a compile error.
- Coalesce with ?? — expr ?? default safely unwraps an optional. Only valid when the left side is an optional type.
- Named pipelines — pipeline name = ... declares a reusable transformation that can be used as a named pipe stage.
- Type patterns — int(n), string(s), float(f), bool(b), list(xs) destructure and bind in one step.
- Guard conditions — if condition appended to any pattern arm for fine-grained filtering.
- Structural patterns — object destructuring { key: binding }, list head/tail [head, ...tail], single-element [x], and empty list [].
- Built-in stages — print, tap, collect, filter, map, split, match, each.
- LLM as a pipe stage — llm(model: "...", prompt: "...") is syntax, not a library call. Outputs are typed as String? and must be handled exhaustively.
- drop for item removal — inside filter, map, or each arms, drop removes the current item from the output.
- Method calls on values — s.uppercase(), s.length, xs.split(" ") work naturally inside arm bodies.
- Arithmetic & logic — +, -, \*, /, %, \*\*, !, &&, ||, ==, !=, <, <=, >, >=.
- Compile to JavaScript — the compiler outputs clean, runnable JS through parse → analyze → optimize → generate.

# Static Rules

Pipethon enforces 13 static constraints at analysis time. Violations are reported with precise source locations.

1. `none`(null) can only be assigned to a variable declared with an explicit optional type (?).
2. The source of a `??` expression must be typed as optional.
3. The left operand of `??` must be an optional type.
4. `llm()` calls must include a `model` argument.
5. `llm()` calls must include a `prompt` argument.
6. Pattern blocks must be exhaustive (must have a wildcard `_` or cover all cases).
7. The wildcard `_` arm must be the last arm in a pattern block.
8. Guard conditions must be boolean expressions.
9. Type annotations in `let` and `pipeline` declarations must name known types.
10. Object patterns must not repeat the same field name.
11. Variables must be declared before use.
12. No two declarations in the same scope may share a name.
13. `drop` may only appear as an arm body inside `filter`, `map`, or `each` stages.

# Examples

## Hello, pipeline

```pipethon
"hello, world" |> print;
```

## Pattern matching with guards

```pipethon
let score: Int = 87n;

score |> {
  int(n) if n >= 90n => "A"
  int(n) if n >= 80n => "B"
  int(n) if n >= 70n => "C"
  int(n)             => "F"
  _                  => "invalid"
} |> print;
// => "B"
```

## Optional / null safety

```pipethon
let username: String? = none;

username ?? "Anonymous" |> print;
// => "Anonymous"

username |> {
  some(name) => name
  none        => "Guest"
} |> print;
// => "Guest"
```

## Multi-stage data pipeline

```pipethon
pipeline validScores = filter {
  int(n) if n >= 0n && n <= 100n => true
  _                               => false
};

pipeline toGrade = map {
  int(n) if n >= 90n => "A"
  int(n) if n >= 80n => "B"
  int(n) if n >= 70n => "C"
  int(n)             => "F"
  _                  => "?"
};

[95n, -5n, 82n, 101n, 67n]
  |> validScores
  |> toGrade
  |> collect
  |> print;
// => ["A", "B", "D"]
```

## LLM as a pipe stage

```pipethon
"Summarize the Gettysburg Address in one sentence."
  |> llm(model: "claude", prompt: "{input}")
  |> {
       some(response) => response
       none           => "No response"
     }
  |> print;
```

## Fibonacci (iterative via pipeline)

```pipethon
let fib10 = [0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n] |> collect;
fib10 |> print;
// => [0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n]
```

# Command-Line Usage

After cloning and running `npm install`:

**Syntax check**

```bash
node src/pipethon.js check examples/data_pipeline.pipe
```

**Show parsed AST**

```bash
node src/pipethon.js parse examples/data_pipeline.pipe
```

**Run semantic analysis**

```bash
node src/pipethon.js analyze examples/data_pipeline.pipe
```

**Show optimized AST**

```bash
node src/pipethon.js optimize examples/data_pipeline.pipe
```

**Generate JavaScript**

```bash
node src/pipethon.js generate examples/data_pipeline.pipe
```

**Compile to a JS file**

```bash
node src/pipethon.js compile examples/data_pipeline.pipe -o out.js
node out.js
```

# Project Structure

```
pipethon/
├── src/
│   ├── pipethon.ohm      # Ohm grammar
│   ├── pipethon.js       # CLI entry point
│   ├── parser.js         # Ohm → AST
│   ├── core.js           # AST node constructors and types
│   ├── analyzer.js       # Semantic analysis (13 static rules)
│   ├── optimizer.js      # Constant folding and strength reductions
│   ├── generator.js      # JavaScript code generation
│   └── compiler.js       # Orchestrates the full pipeline
├── test/
│   ├── parser.test.js
│   ├── analyzer.test.js
│   ├── optimizer.test.js
│   ├── generator.test.js
│   ├── compiler.test.js
│   └── analysis_output.txt
├── examples/
│   ├── fibonacci.pipe
│   ├── higher_order.pipe
│   ├── null_safety.pipe
│   ├── string_processing.pipe
│   └── data_pipeline.pipe
├── docs/                 # GitHub Pages companion site
├── assets/
├── coverage/
├── BOILERPLATE_GUIDE.md
├── index.html
├── LICENSE
├── README.md
├── package.json
└── .gitignore
```

# Getting Started

git clone https://github.com/eliassegura100/pipethon.git
cd pipethon
npm install
npm test

**Group:**
Elias Segura, Garnik Gevorkyan, Riley Vegting

## Grammar

https://github.com/eliassegura100/Pipethon/blob/main/src/pipethon.ohm

## Website Link

https://eliassegura100.github.io/Pipethon/

# License

MIT © Elias Segura, Garnik Gevorkyan, Riley Vegting
