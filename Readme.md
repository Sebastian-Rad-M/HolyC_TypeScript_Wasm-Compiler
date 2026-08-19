# HolyC to WebAssembly Browser Compiler

## Project Goal
To build a complete, client-side compiler that translates TempleOS HolyC source code into WebAssembly (Wasm) and runs it entirely in the browser. 

The project will **not** use a backend server. The compiler itself is written in **TypeScript**. It will parse HolyC code, generate an Abstract Syntax Tree (AST), and use `binaryen.js` to emit a `.wasm` binary on the fly. The browser's JavaScript environment will act as the "Operating System," providing memory allocation and handling built-in HolyC functions (like `Print` and graphics) via WebAssembly imports.

## Why This Architecture?
* **Why not compile to JavaScript/TypeScript?** HolyC is a low-level systems language that relies heavily on raw memory manipulation and pointer arithmetic. JavaScript is garbage-collected and abstracts memory. Transpiling to JS would require writing a slow, buggy virtual machine.
* **Why WebAssembly?** WebAssembly provides **Linear Memory**—a flat array of bytes that perfectly mimics physical RAM. This allows HolyC pointers, `MAlloc`, and `Free` to work exactly as they do in TempleOS natively.
* **Why `binaryen.js`?** It allows us to construct and optimize WebAssembly modules directly in TypeScript without needing a C/LLVM toolchain in the middle.

---

## Tech Stack
* **Language:** TypeScript
* **Compiler Backend:** `binaryen.js` (WebAssembly generation)
* **Frontend/Editor:** HTML/CSS/JS + Monaco Editor (VS Code web engine)
* **Runtime:** HTML5 `<canvas>` and DOM (for stdout/graphics)

---

## Agent Implementation Pipeline

This compiler must be built in a strict, single-pass pipeline. **Do not skip steps or build out of order.**

### Phase 1: Lexer (Tokenizer)
Create a TypeScript lexer that takes a raw HolyC string and outputs an array of Tokens.
* **Requirements:** Handle HolyC-specific quirks, such as implicit typing (`U0`, `I64`, `F64`), string interpolation syntax, and TempleOS directives (e.g., `#exe`).
* **Output:** Stream of `{ type, value, line, column }` objects.

### Phase 2: Parser (AST Generation)
Create a Recursive Descent Parser that consumes the tokens and builds an Abstract Syntax Tree.
* **Requirements:** 
  * Map HolyC types to Wasm types (e.g., `I64` -> `i64`).
  * Handle variable declarations, function declarations, binary/unary expressions, and pointer dereferencing.
* **Output:** A strongly typed TypeScript AST representation.

### Phase 3: Memory Model & Allocator
Design the Wasm Linear Memory layout.
* **Requirements:**
  * Define a stack and a heap.
  * Implement a simple bump allocator or basic `MAlloc`/`Free` in either TypeScript (injected into Wasm) or directly as Wasm instructions via Binaryen.
  * Ensure pointer arithmetic in the AST resolves to byte offsets in this memory space.

### Phase 4: Code Generation (`binaryen.js`)
Traverse the AST and emit WebAssembly instructions using Binaryen.
* **Requirements:**
  * Map HolyC mathematical operations to `binaryen.i64.*` and `binaryen.f64.*`.
  * Map pointer reads/writes to Wasm linear memory `load` and `store` instructions.
  * Output a compiled `.wasm` binary byte array.

### Phase 5: The Runtime Environment (JS Interop)
Build the "Operating System" that the Wasm module will talk to.
* **Requirements:**
  * Create an `importObject` in TypeScript containing host functions.
  * Implement `Print(string_ptr)`: Read strings from Wasm memory and append them to an HTML DOM element (stdout).
  * Implement basic graphics built-ins (e.g., `GrLine`, `GrBlot`) by mapping them to an HTML5 Canvas Context.

### Phase 6: UI and Wiring
Connect the pieces into a usable web app.
* **Requirements:**
  * Embed Monaco Editor for the code input.
  * Wire a "Compile & Run" button that executes `Lexer -> Parser -> Generator -> WebAssembly.instantiate()`.
  * Display execution output and catch/display compiler errors gracefully.

---

## Development Milestones for the Agent

To prevent scope creep, follow these strict iterative milestones. **Do not move to the next milestone until the current one compiles and executes successfully in the browser.**

* **Milestone 1 (The Skeleton):** Compile and run a blank function `U0 Main() { return; }`. No memory, no variables, just successfully parsing, compiling, and instantiating a Wasm module.
* **Milestone 2 (Basic Math):** Add support for basic I64 literal math (`1 + 2 * 3`) and returning the result to JavaScript.
* **Milestone 3 (Variables & Scope):** Implement local variables, assignment, and retrieval from the Wasm stack.
* **Milestone 4 (Hello World):** Implement string literals, linear memory, and the `Print` function import. `Print("Hello World");` must render to the screen.
* **Milestone 5 (Control Flow):** Implement `if`, `else`, `while`, and `for` loops.
* **Milestone 6 (Pointers & Memory):** Implement `MAlloc`, pointer assignment, and pointer dereferencing.
* **Milestone 7 (Graphics):** Implement a Canvas-based graphics import (e.g., draw a line or a dot) triggered by a HolyC function call.
