export class MemoryModel {
  public memory: WebAssembly.Memory;
  private heapPtr: number;

  public readonly STACK_SIZE = 64 * 1024; // Page 0: 64KB Stack
  public readonly STATIC_DATA_SIZE = 64 * 1024; // Page 1: 64KB Static Strings/Globals
  public readonly HEAP_START = this.STACK_SIZE + this.STATIC_DATA_SIZE; // 0x20000

  constructor(initialPages: number = 10, maxPages: number = 256) {
    this.memory = new WebAssembly.Memory({ initial: initialPages, maximum: maxPages });
    this.heapPtr = this.HEAP_START; 
  }

  /**
   * Bump allocator for MAlloc
   * @param size Number of bytes to allocate
   * @returns A BigInt pointer to the allocated linear memory
   */
  public MAlloc(size: number | bigint): bigint {
    const allocSize = typeof size === 'bigint' ? Number(size) : size;
    const ptr = this.heapPtr;
    
    this.heapPtr += allocSize;
    
    // Ensure 8-byte alignment for I64/F64
    if (this.heapPtr % 8 !== 0) {
      this.heapPtr += 8 - (this.heapPtr % 8);
    }
    
    // In a real system, we would check if heapPtr exceeded memory.buffer.byteLength 
    // and call this.memory.grow() if needed.
    if (this.heapPtr > this.memory.buffer.byteLength) {
      const pagesNeeded = Math.ceil((this.heapPtr - this.memory.buffer.byteLength) / 65536);
      this.memory.grow(pagesNeeded);
    }

    return BigInt(ptr);
  }

  /**
   * Bump allocator Free (No-Op)
   */
  public Free(ptr: number | bigint) {
    // A standard bump allocator does not reclaim memory.
  }

  /**
   * Returns the import object to be injected into WebAssembly.instantiate
   */
  public getImportObject() {
    return {
      env: {
        memory: this.memory,
        MAlloc: this.MAlloc.bind(this),
        Free: this.Free.bind(this),
      }
    };
  }

  // Helper methods for inspecting memory during development
  public readI64(ptr: number): bigint {
    const view = new BigInt64Array(this.memory.buffer, ptr, 1);
    return view[0]!;
  }

  public writeI64(ptr: number, value: bigint) {
    const view = new BigInt64Array(this.memory.buffer, ptr, 1);
    view[0] = value;
  }
}
