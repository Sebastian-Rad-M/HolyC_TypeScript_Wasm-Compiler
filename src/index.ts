import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { MemoryModel } from "./memory.js";
import { Runtime } from "./runtime.js";
import { Generator } from "./generator.js";
import fs from "fs";

const code = `
// This is a test HolyC file
#exe { Cd(__DIR__);; }

U0 TestWasm7_Shadowing() {
    "--- WASM Stress 3: Reg Stripping & Scoping ---\\n";
    I64 val = 10;
    {
        // HolyC allows binding to specific x86 registers.
        // Your compiler must parse this, ignore the R15 hardware hint,
        // and map it to a fresh WASM local.
        I64 reg R15 val = 20;
        if (val != 20) {
            "FAIL: Shadowed local did not evaluate correctly.\\n";
            return;
        }
    }
    if (val == 10) {
        "PASS: Hardware register hints safely ignored and scope integrity maintained.\\n";
    } else {
        "FAIL: Outer scope was corrupted.\\n";
    }
}

TestWasm7_Shadowing();
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
