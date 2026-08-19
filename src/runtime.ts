import { MemoryModel } from "./memory.js";

export interface RuntimeOptions {
  stdout?: (text: string) => void;
  // Canvas context would be passed here in Phase 6, but we can mock it for now
  canvasCtx?: any; 
}

export class Runtime {
  public memory: MemoryModel;
  private options: RuntimeOptions;

  constructor(options: RuntimeOptions = {}) {
    this.memory = new MemoryModel();
    this.options = {
      stdout: options.stdout || ((text) => process.stdout.write(text)),
      canvasCtx: options.canvasCtx || null
    };
  }

  /**
   * Reads a null-terminated string from Wasm memory at the given pointer.
   */
  private readString(ptr: number): string {
    const buffer = new Uint8Array(this.memory.memory.buffer);
    let end = ptr;
    while (buffer[end] !== 0) {
      end++;
    }
    const stringBytes = buffer.slice(ptr, end);
    return new TextDecoder().decode(stringBytes);
  }

  /**
   * Print host function
   * Reads the string at string_ptr and outputs it to stdout
   */
  public Print(string_ptr: bigint, ...args: bigint[]): void {
    const ptr = Number(string_ptr);
    let text = this.readString(ptr);
    
    // Simple format string replacement for %d, %X, %c, %f, %s
    for (const arg of args) {
      if (text.includes("%d")) text = text.replace("%d", arg.toString());
      else if (text.includes("%X")) text = text.replace("%X", BigInt.asUintN(64, arg).toString(16).toUpperCase());
      else if (text.includes("%c")) text = text.replace("%c", String.fromCharCode(Number(arg)));
      else if (text.includes("%f")) {
         const floatVal = new Float64Array(new BigInt64Array([arg]).buffer)[0];
         text = text.replace("%f", floatVal!.toFixed(6));
      }
      else if (text.includes("%s")) text = text.replace("%s", this.readString(Number(arg)));
    }
    
    if (this.options.stdout) {
      this.options.stdout(text);
    }
    console.log(`[STDOUT]: ${text}`);
  }

  /**
   * HolyC Graphic Line host function
   * Draws a line from (x1, y1) to (x2, y2)
   */
  public GrLine(x1: bigint, y1: bigint, x2: bigint, y2: bigint): void {
    if (this.options.canvasCtx) {
      this.options.canvasCtx.beginPath();
      this.options.canvasCtx.moveTo(Number(x1), Number(y1));
      this.options.canvasCtx.lineTo(Number(x2), Number(y2));
      this.options.canvasCtx.stroke();
    } else {
      console.log(`[Graphics] GrLine(${x1}, ${y1}, ${x2}, ${y2})`);
    }
  }

  public getImportObject(): WebAssembly.Imports {
    return {
      env: {
        memory: this.memory.memory,
        MAlloc: this.memory.MAlloc.bind(this.memory),
        Free: this.memory.Free.bind(this.memory),
        Print0: (ptr: bigint) => this.Print(ptr),
        Print1: (ptr: bigint, a: bigint) => this.Print(ptr, a),
        Print2: (ptr: bigint, a: bigint, b: bigint) => this.Print(ptr, a, b),
        Print3: (ptr: bigint, a: bigint, b: bigint, c: bigint) => this.Print(ptr, a, b, c),
        Print4: (ptr: bigint, a: bigint, b: bigint, c: bigint, d: bigint) => this.Print(ptr, a, b, c, d),
        GrLine: this.GrLine.bind(this)
      }
    };
  }
}
