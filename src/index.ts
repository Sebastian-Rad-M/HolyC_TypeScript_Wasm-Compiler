import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Generator } from "./generator.js";
import { Runtime } from "./runtime.js";
import { MemoryModel } from "./memory.js";
import { TaskManager } from "./scheduler.js";
import fs from "fs";

const code = `
I64 spawn_counter = 0;

U0 SpawnedTest(I64 val) {
    I64 i;
    for (i = 0; i < 5; i++) {
        spawn_counter += val;
        Yield; // Voluntarily hand control back to the OS scheduler
    }
}

U0 Test13_Tasks() {
    "--- Test 13: Task Management & Yield ---\\n";
    spawn_counter = 0;
    
    // Spawn a child task, passing 10 as the argument data
    CTask *child = Spawn(&SpawnedTest, 10, "TestTask");
    
    I64 i;
    for (i = 0; i < 5; i++) {
        spawn_counter++;
        Yield; // Yield to ensure the child gets interleaved CPU time
    }
    
    // Wait for the spawned task to completely finish
    Sleep(50); 
    
    // 5 iterations of +1 (parent) and 5 iterations of +10 (child)
    if (spawn_counter == 55) {
        "PASS: Task spawned and cooperative Yield maintained context.\\n";
    } else {
        "FAIL: Task scheduler failed or context corruption occurred.\\n";
    }
}

Test13_Tasks();
`;

const lexer = new Lexer(code);
try {
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log("\n--- Phase 3: Memory Model Test ---");
  const memory = new MemoryModel();
  
  const ptr1 = memory.MAlloc(8);
  const ptr2 = memory.MAlloc(4);
  const ptr3 = memory.MAlloc(8); 

  console.log(`Allocated 8 bytes at: 0x${ptr1.toString(16)}`);
  console.log(`Allocated 4 bytes at: 0x${ptr2.toString(16)}`);
  console.log(`Allocated 8 bytes at: 0x${ptr3.toString(16)} (Aligned)`);

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
