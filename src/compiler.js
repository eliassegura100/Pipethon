// compiler.js — ties the Pipethon compiler pipeline together.
// Can be used programmatically (e.g. from tests) or via pipethon.js CLI.

import parse from "./parser.js"
import analyze from "./analyzer.js"
import optimize from "./optimizer.js"
import generate from "./generator.js"

export default function compile(source, outputType) {
  if (!["parsed", "analyzed", "optimized", "js"].includes(outputType)) {
    throw new Error(`Unknown output type: ${outputType}`)
  }
  const match = parse(source)
  if (outputType === "parsed") return "Syntax is ok"
  const analyzed = analyze(match)
  if (outputType === "analyzed") return analyzed
  const optimized = optimize(analyzed)
  if (outputType === "optimized") return optimized
  return generate(optimized)
}