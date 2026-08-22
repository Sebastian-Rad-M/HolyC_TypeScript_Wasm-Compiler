import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Generator } from "./generator.js";
import { Runtime } from "./runtime.js";
import { TaskManager } from "./scheduler.js";
import fs from "fs";

const code = `
U0 Test9_SwitchRanges() {
    "--- Test 9: Switch Statements & Ranges ---\\n";
    I64 val = 7;
    I64 result = 0;
    
    switch (val) {
        case 1...5:
            result = 1;
            break;
        case 6...10:
            result = 2;
            break;
        default:
            result = -1;
    }
    
    if (result == 2) {
        "PASS: Switch statements and range parsing working.\\n";
    } else {
        "FAIL: Switch statement branching or bounds checking broken.\\n";
    }
}
Test9_SwitchRanges();
`;

const lexer = new Lexer(code);
try {
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  
  // Phase 4 & 5: Code Generation & Runtime Test
  console.log("\n--- Phase 5: Code Generation & Runtime Test ---");
  const generator = new Generator();
  const wasmBinary = generator.generate(ast);
  fs.writeFileSync("test.wast", generator.module.emitText());
  
  fs.writeFileSync("test.wasm", wasmBinary);
  console.log(`Generated test.wasm (${wasmBinary.length} bytes)`);

  // Execute
  const wasmModule = new WebAssembly.Module(wasmBinary as any);
  const runtime = new Runtime();
  const taskManager = new TaskManager(runtime.memory);
  
  const importObject = runtime.getImportObject();
  importObject.env = { ...importObject.env, ...taskManager.getImports() };
  delete importObject.env?.memory;
  
  const wasmInstance = new WebAssembly.Instance(wasmModule, importObject);
  runtime.memory.memory = wasmInstance.exports.memory as WebAssembly.Memory;
  taskManager.setInstance(wasmInstance);

  console.log("Successfully instantiated Wasm module!");
  
  if (typeof (wasmInstance.exports as any)._start === "function") {
    console.log("Executing global statements (Main Task)...");
    taskManager.spawnMain(() => {
        (wasmInstance.exports as any)._start();
        if (typeof (wasmInstance.exports as any).Main === "function") {
            const result = (wasmInstance.exports as any).Main();
            console.log(`Main() returned:`, result);
        }
    });
  } else if (typeof (wasmInstance.exports as any).Main === "function") {
    console.log("Executing Main()...");
    taskManager.spawnMain(() => {
        const result = (wasmInstance.exports as any).Main();
        console.log(`Main() returned:`, result);
    });
  } else {
    console.log("No Main() function exported and no global statements to execute.");
  }

} catch (e) {
  console.error("Error:", e);
}
