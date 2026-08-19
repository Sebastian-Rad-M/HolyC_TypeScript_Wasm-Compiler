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
  public Print(string_ptr: bigint): void {
    const ptr = Number(string_ptr);
    const text = this.readString(ptr);
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

  /**
   * The complete import object for WebAssembly.instantiate
   */
  public getImportObject(): WebAssembly.Imports {
    return {
      env: {
        memory: this.memory.memory,
        MAlloc: this.memory.MAlloc.bind(this.memory),
        Free: this.memory.Free.bind(this.memory),
        Print: this.Print.bind(this),
        GrLine: this.GrLine.bind(this)
      }
    };
  }
}
