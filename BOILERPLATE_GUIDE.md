# Pipethon Compiler Boilerplate Guide

## Overview

This document describes the boilerplate structure created for the Pipethon compiler project. The structure follows the course requirements and implements a complete compilation pipeline with a professional CLI interface.

## Project Structure

```
.
├── src/
│   ├── pipethon.js        Main CLI entry point
│   ├── pipethon.ohm       Ohm grammar definition
│   ├── parser.js          Source to AST parser
│   ├── analyzer.js        Semantic analyzer
│   ├── optimizer.js       Code optimizer
│   ├── generator.js       Code generator
│   ├── compiler.js        Compilation orchestrator
│   └── core.js            Utility functions & AST constructors
├── test/
│   ├── parser.test.js     Parser tests
│   ├── analyzer.test.js   Analyzer tests
│   ├── optimizer.test.js  Optimizer tests
│   ├── generator.test.js  Generator tests
│   └── compiler.test.js   Integration tests
├── examples/              Example Pipethon programs (add your files here)
├── docs/                  Website & documentation (add your files here)
├── package.json           Project metadata (UPDATED)
└── README.md              Project README (UPDATE NEEDED)
```

## Module Descriptions

### **src/pipethon.js** - CLI Entry Point
The main command-line interface with the following commands:
```bash
pipethon check <file>       # Validate syntax
pipethon parse <file>       # Parse and output AST
pipethon analyze <file>     # Perform semantic analysis
pipethon optimize <file>    # Optimize and output AST
pipethon generate <file>    # Generate target code
pipethon compile <file>     # Full compilation (can add -o output)
```

**Status**: ✅ Ready to use as-is
**Team work needed**: Test from command line as the project grows

---

### **src/pipethon.ohm** - Grammar Definition
Defines the complete syntax of Pipethon including:
- Pipelines (main language primitive)
- Pattern matching
- Functions and variables
- Types and literals
- Comments

**Status**: 📝 Needs refinement based on your language design
**Team work needed**: 
- Add/remove grammar rules as your language evolves
- Add more specific types and operators
- Define any special syntax for your language theme

---

### **src/parser.js** - Syntax Parser
Transforms source code → AST using the Ohm grammar.

**Status**: ✅ Boilerplate complete, needs semantic actions
**Team work needed**:
- Implement the `semantics.addOperation('ast', {...})` to build actual AST nodes
- Add proper error messages with line/column information
- Test thoroughly with `pipethon parse` command

---

### **src/analyzer.js** - Semantic Analyzer
Performs static analysis on the AST:
- Scope resolution
- Type checking & inference
- Control flow validation (return/break/continue)
- Pattern exhaustiveness checking
- Custom constraint validation

**Status**: 📝 Skeleton with function stubs
**Team work needed**:
- Implement `analyzeNode()` to dispatch by node type
- Implement `resolveScopes()` for variable scoping
- Implement `typeCheck()` for type validation
- Implement `validateReturns()`, `validateControlFlow()`, etc.
- Add your language's custom constraints

---

### **src/optimizer.js** - Code Optimizer
Non-trivial optimizations include:
- Dead code elimination
- Pipeline fusion
- Constant folding
- Common subexpression elimination
- Pattern optimization

**Status**: 📝 Skeleton with optimization function stubs
**Team work needed**:
- Implement at least 2-3 non-trivial optimizations
- Ensure optimizations preserve semantics
- Add AST traversal/transformation logic for each optimization

---

### **src/generator.js** - Code Generator
Transforms optimized AST → JavaScript target code.

**Status**: 📝 Skeleton with `JavaScriptGenerator` class
**Team work needed**:
- Implement `generateStatement()` for all statement types
- Implement `generateExpression()` for all expression types
- Implement `generatePipeline()`, `generateFunction()`, etc.
- Ensure generated code is readable and correct
- Test with `pipethon generate` command

---

### **src/compiler.js** - Compilation Orchestrator
Coordinates the full pipeline: parse → analyze → optimize → generate

**Status**: ✅ Complete and ready to use
**Team work needed**: The other modules will power this automatically

---

### **src/core.js** - Core Utilities
Provides:
- AST node constructors (`createProgram()`, `createFunction()`, etc.)
- Type utilities
- Error handling and formatting
- Common algorithms

**Status**: ✅ Ready to extend with more utilities
**Team work needed**: Add utilities as your language grows

---

## Test Structure

All test files follow this pattern:
```javascript
import test from 'node:test'
import assert from 'node:assert'
// import modules to test

test('Module - Feature Category', async t => {
  await t.test('specific test case', () => {
    // implementation
  })
})
```

**Status**: 📝 Test skeletons provided
**Team work needed**:
- Replace `// Add test implementation` with actual test code
- Aim for **100% code coverage** across all modules
- Each test category should have multiple specific tests

---

## Package.json Updates

✅ Updated with:
- `"type": "module"` for ES6 imports
- `bin` entry pointing to `pipethon.js` for CLI
- Test script: `npm test`
- Coverage script: `npm run coverage`
- Convenience scripts: `npm run check`, `npm run parse`, etc.
- Team member names in author field
- Repository link (update the URL!)
- Development dependencies for testing

---

## Next Steps for Your Team

### Phase 1: Language Design Refinement (Week 1-2)
1. **Grammar**: Refine [src/pipethon.ohm](src/pipethon.ohm)
   - Add/remove syntax rules
   - Define operators and precedence
   - Add special constructs for your language

2. **Parser AST**: Implement semantic actions in [src/parser.js](src/parser.js)
   - Build actual AST nodes using `core.js` constructors
   - Add error reporting with positions

### Phase 2: Semantic Analysis (Week 3-4)
1. **Analyzer**: Implement in [src/analyzer.js](src/analyzer.js)
   - Scope resolution
   - Type checking
   - Your custom language constraints
   - Control flow validation

2. **Tests**: Write comprehensive tests in test files
   - Aim for 100% coverage
   - Test both valid and invalid programs

### Phase 3: Optimization & Generation (Week 5-6)
1. **Optimizer**: Implement in [src/optimizer.js](src/optimizer.js)
   - Choose non-trivial optimizations for your language
   - Verify they preserve semantics

2. **Generator**: Implement in [src/generator.js](src/generator.js)
   - Transform AST to readable JavaScript
   - Test with `pipethon generate`

3. **Complete Tests**: Reach 100% coverage
   - Integration tests for full compile pipeline

### Phase 4: Examples & Documentation (Week 7-8)
1. Create example programs in `examples/`
2. Update README with examples and language description
3. Create companion website in `docs/`

---

## CLI Usage Examples

As your compiler grows, you can use:

```bash
# Check syntax
npm run check examples/hello.pt

# Parse and see AST
npm run parse examples/hello.pt

# Analyze semantically
npm run analyze examples/hello.pt

# View optimized AST
npm run optimize examples/hello.pt

# Generate JavaScript
npm run generate examples/hello.pt

# Full compilation
npm run compile examples/hello.pt -o output.js

# Run tests with coverage
npm run coverage
```

---

## Important Reminders

✅ **Follow the checklist** from the assignment:
- Keep repo clean (no `node_modules`, `.DS_Store`, etc.)
- Use Prettier for code formatting
- Provide 100% test coverage
- Document all static analysis constraints in README
- Create meaningful example programs
- Include your boilerplate grammar link in README

✅ **Code Quality**:
- Keep functions small and focused
- Write clear error messages
- Use consistent naming
- Add JSDoc comments to all public functions
- Run `npm test` frequently

---

## Questions or Issues?

- Check the boilerplate comments for detailed function documentation
- Refer to the Ohm documentation for grammar help
- Test modules individually before integration
- Use the CLI tools to debug each phase

Good luck with Pipethon! 🚀
