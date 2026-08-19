import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { MemoryModel } from "./memory.js";
import { Runtime } from "./runtime.js";
import { Generator } from "./generator.js";
import fs from "fs";

const code = `
class MixedData {
    U8  a;      // 1 byte
    // 7 bytes of padding should exist here by default
    I64 b;      // 8 bytes
    U16 c;      // 2 bytes
    // 6 bytes of padding should exist here
}; // Total size should be 24 bytes, not 11 bytes.

U0 TestWasm9_Alignment() {
    "--- WASM Stress 5: Class Alignment ---\\n";
    MixedData arr[2];
    
    arr[0].b = 777;
    arr[1].b = 888;
    
    // If the compiler tightly packs the struct (size 11), 
    // pointer arithmetic for arr[1] will read the wrong linear memory offset.
    if (sizeof(MixedData) == 24 && arr[1].b == 888) {
        "PASS: Compiler padding matches HolyC x86-64 expectations.\\n";
    } else {
        "FAIL: Compiler is tightly packing structs. Pointer math is corrupted.\\n";
    }
}

TestWasm9_Alignment();
`;

const lexer = new Lexer(code);
try {
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log("\\n--- Phase 3: Memory Model Test ---");
  const memory = new MemoryModel();
  
  const ptr1 = memory.MAlloc(8);
  const ptr2 = memory.MAlloc(4);
  const ptr3 = memory.MAlloc(8); 

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
  
  if (typeof (wasmInstance.exports as any)._start === "function") {
    console.log("Executing global statements...");
    (wasmInstance.exports as any)._start();
  }
  
  if (typeof (wasmInstance.exports as any).Main === "function") {
    console.log("Executing Main()...");
    const result = (wasmInstance.exports as any).Main();
    console.log(`Main() returned:`, result);
  } else if (typeof (wasmInstance.exports as any)._start !== "function") {
    console.log("No Main() function exported and no global statements to execute.");
  }

} catch (e) {
  console.error("Error:", e);
}
