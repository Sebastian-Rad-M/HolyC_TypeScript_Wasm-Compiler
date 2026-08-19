# HolyC to WebAssembly Translator Documentation

This document provides a comprehensive overview of the HolyC to WebAssembly (Wasm) Translator, an in-browser compiler written in TypeScript. 

## Overview

The HolyC Translator parses HolyC code (the language used in TempleOS) and compiles it entirely on the client side to a WebAssembly binary. The generated Wasm binary is then executed in the browser. WebAssembly linear memory is used to simulate physical RAM, while a TypeScript runtime environment simulates the "Operating System" by providing essential host functions such as `Print` and `GrLine`.

## Architecture

The compiler is organized into a strict, single-pass pipeline:

1. **Lexer (`src/lexer.ts`)**
2. **Parser (`src/parser.ts`)**
3. **Generator (`src/generator.ts`)**
4. **Runtime & Memory Model (`src/runtime.ts` & `src/memory.ts`)**

### 1. Lexical Analysis (`lexer.ts`)
The `Lexer` breaks down raw HolyC source code into a stream of `Token` objects.
* Supports HolyC primitives (`U0`, `I64`, `F64`, `I8`, `U8`).
* Handles string literals, character literals (converted directly to ASCII numbers), and numbers.
* Recognizes directives (e.g., `#exe`), keywords, operators, and punctuation.
* Optimized using lookup maps for single-character and keyword tokens to remain concise and highly performant.

### 2. Syntax Analysis (`parser.ts`)
The `Parser` implements a Recursive Descent algorithm to consume tokens and construct an Abstract Syntax Tree (AST).
* **AST Definition (`ast.ts`)**: Strongly typed TypeScript interfaces representing expressions and statements.
* **Precedence Parsing**: Binary expressions (logical operations, equalities, terms, and factors) are parsed using a unified `parseBinary` method.
* Produces structured output for function declarations, variable declarations, loops (`while`, `for`), conditionals (`if`), and function calls.

### 3. Code Generation (`generator.ts`)
The `Generator` uses `binaryen.js` to traverse the AST and emit a `.wasm` binary.
* **Memory Setup**: Configures linear memory for strings and future heap allocations.
* **Type Mapping**: Translates HolyC types to Wasm types (e.g., `I64` -> `i64`).
* **Expression Lowering**: Converts mathematical operations to their `binaryen` instruction equivalents.
* **Local Variables**: Does a first pass to extract variable declarations and maps them to Wasm local indices.
* **Static Strings**: Encodes strings as null-terminated UTF-8 data segments in static memory and replaces them with pointers in the emitted code.

### 4. Runtime & Memory (`runtime.ts` / `memory.ts`)
The `Runtime` provides the JavaScript interop layer that the Wasm module talks to.
* **Memory Model**: Simulates the system heap/stack. A bump allocator (`MAlloc`) is provided for dynamic allocations, ensuring 8-byte alignment.
* **Host Functions**:
  * `Print`: Reads a null-terminated string from Wasm memory using its pointer and outputs it to the DOM/stdout.
  * `GrLine`: Intercepts graphics calls and draws to an HTML5 `<canvas>`.
* Wraps everything in an `importObject` which is injected into the Wasm module upon instantiation.

## Building and Running

### Prerequisites
* Node.js (v16+ recommended)
* npm

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```
   This uses Astro to bundle the compiler and static assets into the `dist/` directory.

3. Run locally (dev mode):
   ```bash
   npm run dev
   ```

## Supported HolyC Features (Current Status)

The compiler currently supports a fundamental subset of HolyC:
- **Primitives**: `I64`, `F64`, `U0` (void), `U8`, `I8`
- **Control Flow**: `if`, `else`, `while`, `for`, `return`
- **Expressions**: Basic arithmetic (`+`, `-`, `*`, `/`), logical and comparative operators (`==`, `!=`, `<`, `>`, `&&`, `||`)
- **Pointers**: Pointer dereferencing (`*ptr = value`) and assignment.
- **Built-in Calls**: `Print("string")`, `GrLine(x1, y1, x2, y2)`

## File Structure

```text
src/
├── ast.ts           # Abstract Syntax Tree type definitions
├── generator.ts     # Binaryen Wasm generation
├── index.ts         # Main entry point and CLI exports
├── lexer.ts         # Tokenizer
├── main.ts          # Browser UI wiring (Monaco Editor & execution)
├── memory.ts        # Memory layout and MAlloc implementation
├── parser.ts        # Recursive descent parser
└── runtime.ts       # Host OS bindings (Print, graphics)
```

## Adding New Features
To add a new language feature to the compiler:
1. **Lexer**: Add any new keywords or operators to `TokenType` in `lexer.ts` and ensure they are parsed.
2. **AST**: Define the new node interface in `ast.ts`.
3. **Parser**: Update `parser.ts` to recognize the tokens and build the new AST node.
4. **Generator**: Add the corresponding Binaryen emission logic to `generator.ts` (e.g., adding a new `case` in `generateStatement` or `generateExpression`).
