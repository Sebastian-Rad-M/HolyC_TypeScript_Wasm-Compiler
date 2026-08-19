import * as monaco from 'monaco-editor';

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Generator } from './generator.js';
import { Runtime } from './runtime.js';

const defaultCode = `U0 Main() {
  I64 x = 1 + 2 * 3;
  if (x == 7) {
    Print("Hello HolyC from Wasm!\\n");
  }
  
  GrLine(50, 50, 200, 200);
  
  return;
}
`;

const editor = monaco.editor.create(document.getElementById('editor-container')!, {
  value: defaultCode,
  language: 'cpp', // okay, so let me cook. its either C, C++ or no synthax highlithing. take your pick
  theme: 'vs-dark',
  automaticLayout: true,
  minimap: { enabled: false }
});

const outputEl = document.getElementById('output')!;
const canvasEl = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvasEl.getContext('2d')!;

function log(msg: string) {
  outputEl.textContent += msg + '\n';
  outputEl.scrollTop = outputEl.scrollHeight;
}

document.getElementById('clear-btn')!.addEventListener('click', () => {
  outputEl.textContent = '';
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
});

document.getElementById('run-btn')!.addEventListener('click', async () => {
  const code = editor.getValue();
  try {
    const tokens = new Lexer(code).tokenize();
    const ast = new Parser(tokens).parse();
    
    const generator = new Generator();
    const wasmBinary = generator.generate(ast);
    log(`Compiled to Wasm (${wasmBinary.length} bytes).`);
    
    const runtime = new Runtime({
      stdout: (text: string) => outputEl.textContent += text,
      canvasCtx: ctx
    });
    
    const importObject = runtime.getImportObject();
    delete importObject.env?.memory; // we use exported memory instead
    
    const wasmModule = await WebAssembly.compile(wasmBinary as any);
    const instance = await WebAssembly.instantiate(wasmModule, importObject);
    
    // Link exported memory back to runtime
    runtime.memory.memory = instance.exports.memory as WebAssembly.Memory;
    
    if (typeof (instance.exports as any)._start === "function") {
      (instance.exports as any)._start();
    }
    
    if (typeof (instance.exports as any).Main === "function") {
      (instance.exports as any).Main();
    } else if (typeof (instance.exports as any)._start !== "function") {
      log("Error: No Main() function found and no global statements to execute.");
    } else {
      log("Execution complete.");
    }
    
  } catch (err: any) {
    log(`\\n[Compiler Error] ${err.message || err}`);
    console.error(err);
  }
});
