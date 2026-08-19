import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { MemoryModel } from "./memory.js";
import { Runtime } from "./runtime.js";
import { Generator } from "./generator.js";
import fs from "fs";

const code = `
// This is a test HolyC file
#exe { Cd(__DIR__);; }

I64 Main() {
  I64 x = 1 + 2 * 3;
  if (x == 7) {
    Print("Hello World\\n");
    I64 y = 'A';
  }
  return x;
}
`;

const lexer = new Lexer(code);
try {
  const tokens = lexer.tokenize();
  // console.log("Tokens:");
  // tokens.forEach(t => console.log(`  [${t.type}] ${t.value} (Line ${t.line}, Col ${t.column})`));
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  // console.log("AST:");
  // console.dir(ast, { depth: null });

  // Phase 3: Memory Model & Allocator Test
  console.log("\\n--- Phase 3: Memory Model Test ---");
  const memory = new MemoryModel();
  
  const ptr1 = memory.MAlloc(8);
  const ptr2 = memory.MAlloc(4);
  const ptr3 = memory.MAlloc(8); // Should align to 8-byte boundary

  console.log(`Allocated 8 bytes at: 0x${ptr1.toString(16)}`);
  console.log(`Allocated 4 bytes at: 0x${ptr2.toString(16)}`);
  console.log(`Allocated 8 bytes at: 0x${ptr3.toString(16)} (Aligned)`);

  // Phase 4 & 5: Code Generation & Runtime Test
  console.log("\\n--- Phase 5: Code Generation & Runtime Test ---");
  const generator = new Generator();
  const wasmBinary = generator.generate(ast);
  
  fs.writeFileSync("test.wasm", wasmBinary);
  console.log(`Generated test.wasm (${wasmBinary.length} bytes)`);

  // Execute
  const wasmModule = new WebAssembly.Module(wasmBinary as any);
  const runtime = new Runtime();
  // Wasm defines and exports the memory now
  const importObject = runtime.getImportObject();
  // Remove the memory from imports because we export it instead
  delete importObject.env?.memory;
  
  const wasmInstance = new WebAssembly.Instance(wasmModule, importObject);
  // Connect the Wasm memory back to the runtime so host functions can read it
  runtime.memory.memory = wasmInstance.exports.memory as WebAssembly.Memory;

  console.log("Successfully instantiated Wasm module!");
  
  if (typeof (wasmInstance.exports as any).Main === "function") {
    console.log("Executing Main()...");
    const result = (wasmInstance.exports as any).Main();
    console.log(`Main() returned:`, result);
  } else {
    console.log("No Main() function exported.");
  }

} catch (e) {
  console.error("Error:", e);
}
