import binaryen from "binaryen";
import fs from "fs";
import { MemoryModel } from "./src/memory.js";
import { Runtime } from "./src/runtime.js";

const module = new binaryen.Module();
module.addMemoryImport("0", "env", "memory", false);
module.setMemory(10, 256, null, [{
  offset: module.i32.const(0x10000),
  data: new TextEncoder().encode("Hello World\\0"),
  passive: false
}], false);

module.addFunctionImport("Print", "env", "Print", binaryen.createType([binaryen.i64]), binaryen.none);

module.addFunction("Main", binaryen.createType([]), binaryen.none, [],
  module.block(null, [
    module.call("Print", [module.i64.const(0x10000n)], binaryen.none)
  ])
);
module.addFunctionExport("Main", "Main");

if (!module.validate()) throw new Error("Validation failed");

const wasm = module.emitBinary();
const runtime = new Runtime();
const instance = new WebAssembly.Instance(new WebAssembly.Module(wasm as any), runtime.getImportObject());

const view = new Uint8Array(runtime.memory.memory.buffer);
console.log("Memory at 0x10000:", Array.from(view.slice(0x10000, 0x10000 + 12)));

(instance.exports as any).Main();
