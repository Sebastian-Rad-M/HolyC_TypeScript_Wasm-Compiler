
import binaryen from "binaryen";
import * as AST from "./ast.js";

export class Generator {
  public module: binaryen.Module;
  private currentLocals = new Map<string, { index: number, type: binaryen.Type, className?: string, isMemLocal?: boolean, pointerDepth?: number, holycType?: string }>();
  private globalTypes = new Map<string, { type: binaryen.Type, className?: string, pointerDepth?: number, holycType?: string }>();
  private classLayouts = new Map<string, { size: number, members: Map<string, { offset: number, type: binaryen.Type, pointerDepth?: number, holycType?: string }> }>();
  private functions = new Map<string, AST.FunctionDeclaration>();
  private stringTable: { offset: number, data: Uint8Array }[] = [];
  private staticDataPtr = 0x10000;
  
  constructor() {
    this.module = new binaryen.Module();
    // We will set memory in generate() once we know all strings
    
    this.module.addFunctionImport("Print0", "env", "Print0", binaryen.createType([binaryen.i64]), binaryen.none);
    this.module.addFunctionImport("Print1", "env", "Print1", binaryen.createType([binaryen.i64, binaryen.i64]), binaryen.none);
    this.module.addFunctionImport("Print2", "env", "Print2", binaryen.createType([binaryen.i64, binaryen.i64, binaryen.i64]), binaryen.none);
    this.module.addFunctionImport("Print3", "env", "Print3", binaryen.createType([binaryen.i64, binaryen.i64, binaryen.i64, binaryen.i64]), binaryen.none);
    this.module.addFunctionImport("Print4", "env", "Print4", binaryen.createType([binaryen.i64, binaryen.i64, binaryen.i64, binaryen.i64, binaryen.i64]), binaryen.none);
    this.module.addFunctionImport("GrLine", "env", "GrLine", binaryen.createType([binaryen.i64, binaryen.i64, binaryen.i64, binaryen.i64]), binaryen.none);
  }

  private mapType(type: AST.Type | string, pointerDepth: number = 0): binaryen.Type {
    if (pointerDepth > 0) return binaryen.i64;
    switch (type) {
      case "U0": return binaryen.none;
      case "I64": 
      case "U64": return binaryen.i64;
      case "F64": return binaryen.f64;
      case "I32":
      case "U32":
      case "I16":
      case "U16":
      case "I8":
      case "U8": return binaryen.i64; // Wait! In HolyC everything on the stack is 64-bit anyway! Let's just use i64 for ALL local variables to fix type mismatch easily!
      default: 
        if (this.classLayouts.has(type as string)) return binaryen.i64; // classes are passed by reference (pointers)
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  public generate(program: AST.Program): Uint8Array {
    const collectStrings = (expr: AST.Expression) => {
        if (expr.type === "StringLiteral") {
            const encoder = new TextEncoder();
            const data = encoder.encode(expr.value + "\0");
            this.stringTable.push({ offset: this.staticDataPtr, data });
            expr.rawValue = this.staticDataPtr.toString();
            this.staticDataPtr += data.length;
        } else if (expr.type === "BinaryExpression") {
            collectStrings(expr.left); collectStrings(expr.right);
        } else if (expr.type === "CallExpression") {
            expr.arguments.forEach(collectStrings);
        } else if (expr.type === "AssignmentExpression") {
            collectStrings(expr.left); collectStrings(expr.right);
        } else if (expr.type === "UnaryExpression") {
            collectStrings(expr.argument);
        } else if (expr.type === "MemberExpression" || expr.type === "IndexExpression") {
            collectStrings(expr.object);
            if (expr.type === "IndexExpression") collectStrings(expr.index);
        }
    };
    const scanStrings = (stmt: AST.Statement) => {
        if (stmt.type === "VariableDeclaration" && stmt.initializer) collectStrings(stmt.initializer);
        if (stmt.type === "ExpressionStatement") collectStrings(stmt.expression);
        if (stmt.type === "ReturnStatement" && stmt.argument) collectStrings(stmt.argument);
        if (stmt.type === "IfStatement") { collectStrings(stmt.test); scanStrings(stmt.consequent); if (stmt.alternate) scanStrings(stmt.alternate); }
        if (stmt.type === "ForStatement") {
            if (stmt.init) scanStrings(stmt.init);
            if (stmt.test) collectStrings(stmt.test);
            if (stmt.update) collectStrings(stmt.update);
            scanStrings(stmt.body);
        }
        if (stmt.type === "BlockStatement") stmt.body.forEach(scanStrings);
        if (stmt.type === "FunctionDeclaration") stmt.body.body.forEach(scanStrings);
    };
    program.body.forEach(scanStrings);

    const segments = this.stringTable.map(s => ({
      offset: this.module.i32.const(s.offset),
      data: s.data,
      passive: false
    }));
    this.module.setMemory(10, 256, "memory", segments, false, false, "0");
    this.module.addGlobal("heap_ptr", binaryen.i32, true, this.module.i32.const(0x20000));

    const functions: AST.FunctionDeclaration[] = [];
    const globalStmts: AST.Statement[] = [];
    for (const stmt of program.body) {
      if (stmt.type === "FunctionDeclaration") {
        functions.push(stmt);
        this.functions.set(stmt.name, stmt);
      } else if (stmt.type === "VariableDeclaration") {
        const type = this.mapType(stmt.varType, stmt.pointerDepth);
        const className = this.classLayouts.has(stmt.varType) ? stmt.varType : undefined;
        this.globalTypes.set(stmt.name, { type, className, pointerDepth: stmt.pointerDepth, holycType: stmt.varType });
        let initExpr = this.module.i32.const(0);
        if (type === binaryen.i64 || type === binaryen.f64) {
          initExpr = type === binaryen.i64 ? this.module.i64.const(0n) : this.module.f64.const(0);
        }
        if (stmt.initializer && stmt.initializer.type === "NumberLiteral") {
          if (type === binaryen.i64) initExpr = this.module.i64.const(BigInt(stmt.initializer.rawValue || stmt.initializer.value));
          else if (type === binaryen.f64) initExpr = this.module.f64.const(stmt.initializer.value);
          else initExpr = this.module.i32.const(stmt.initializer.value);
        }
        this.module.addGlobal(stmt.name, type, true, initExpr);
      } else if (stmt.type === "ClassDeclaration") {
        let offset = 0;
        const members = new Map<string, { offset: number, type: binaryen.Type, pointerDepth?: number, holycType?: string }>();
        for (const mem of stmt.members) {
           const type = this.mapType(mem.varType, mem.pointerDepth);
           members.set(mem.name, { offset, type, pointerDepth: mem.pointerDepth, holycType: mem.varType });
           offset += 8;
        }
        this.classLayouts.set(stmt.name, { size: offset, members });
      } else {
        globalStmts.push(stmt);
      }
    }
    
    if (globalStmts.length > 0) {
      const startFunc: AST.FunctionDeclaration = {
        type: "FunctionDeclaration",
        returnType: "U0",
        name: "_start",
        params: [],
        body: { type: "BlockStatement", body: globalStmts }
      };
      functions.push(startFunc);
      this.functions.set("_start", startFunc);
    }
    
    for (const func of functions) {
       this.generateFunction(func);
    }

    if (!this.module.validate()) {
      throw new Error("Binaryen validation failed! The generated Wasm is invalid.");
    }
    return this.module.emitBinary();
  }

  private generateFunction(node: AST.FunctionDeclaration) {
    const returnType = this.mapType(node.returnType);
    this.currentLocals.clear();
    
    const localsWithAddressTaken = new Set<string>();
    const scanExpression = (expr: AST.Expression) => {
      if (expr.type === "UnaryExpression" && expr.operator === "&" && expr.argument.type === "Identifier") localsWithAddressTaken.add(expr.argument.name);
      if (expr.type === "BinaryExpression") { scanExpression(expr.left); scanExpression(expr.right); }
      if (expr.type === "CallExpression") expr.arguments.forEach(scanExpression);
    };
    const scanStatement = (stmt: AST.Statement) => {
       if (stmt.type === "ExpressionStatement") scanExpression(stmt.expression);
       if (stmt.type === "IfStatement") { scanExpression(stmt.test); scanStatement(stmt.consequent); if (stmt.alternate) scanStatement(stmt.alternate); }
       if (stmt.type === "ReturnStatement" && stmt.argument) scanExpression(stmt.argument);
       if (stmt.type === "BlockStatement") stmt.body.forEach(scanStatement);
       if (stmt.type === "ForStatement") {
          if (stmt.init) scanStatement(stmt.init);
          if (stmt.test) scanExpression(stmt.test);
          if (stmt.update) scanExpression(stmt.update);
          scanStatement(stmt.body);
       }
    };
    node.body.body.forEach(scanStatement);

    const paramTypes = node.params.map(p => this.mapType(p.varType, p.pointerDepth));
    node.params.forEach((p, i) => {
      const className = this.classLayouts.has(p.varType) ? p.varType : undefined;
      const isMemLocal = localsWithAddressTaken.has(p.name);
      this.currentLocals.set(p.name, { index: i, type: paramTypes[i]!, className, isMemLocal, pointerDepth: p.pointerDepth, holycType: p.varType });
    });

    const localTypes: binaryen.Type[] = [];
    const localInitStmts: AST.Statement[] = [];
    
    const extractLocals = (stmt: AST.Statement) => {
      if (stmt.type === "VariableDeclaration") {
        const type = this.mapType(stmt.varType, stmt.pointerDepth);
        const className = this.classLayouts.has(stmt.varType) ? stmt.varType : undefined;
        const isMemLocal = localsWithAddressTaken.has(stmt.name) || !!stmt.arraySize;
        this.currentLocals.set(stmt.name, { index: node.params.length + localTypes.length, type, className, isMemLocal, pointerDepth: stmt.pointerDepth, holycType: stmt.varType, arraySize: stmt.arraySize });
        localTypes.push(type);
        if (className && stmt.pointerDepth === 0) localInitStmts.push(stmt);
        else if (isMemLocal) localInitStmts.push(stmt);
        else if (stmt.initializer) localInitStmts.push(stmt);
      } else if (stmt.type === "BlockStatement") {
        stmt.body.forEach(extractLocals);
      } else if (stmt.type === "IfStatement") {
        extractLocals(stmt.consequent);
        if (stmt.alternate) extractLocals(stmt.alternate);
      } else if (stmt.type === "WhileStatement") {
        extractLocals(stmt.body);
      } else if (stmt.type === "ForStatement") {
        if (stmt.init) extractLocals(stmt.init);
        extractLocals(stmt.body);
      }
    };
    node.body.body.forEach(extractLocals);

    const blockStmts: binaryen.ExpressionRef[] = [];
    for (const stmt of localInitStmts) {
      if (stmt.type === "VariableDeclaration") {
        const { index, isMemLocal, className } = this.currentLocals.get(stmt.name)!;
        let initExpr = 0;
        
        let allocSize = 0;
        if (stmt.arraySize && stmt.arraySize.type === "NumberLiteral") {
            const numElements = stmt.arraySize.value;
            let bytes = 8;
            if (stmt.pointerDepth === 1 && (stmt.varType === "I8" || stmt.varType === "U8")) bytes = 1;
            else if (stmt.pointerDepth === 1 && (stmt.varType === "I16" || stmt.varType === "U16")) bytes = 2;
            else if (stmt.pointerDepth === 1 && (stmt.varType === "I32" || stmt.varType === "U32")) bytes = 4;
            allocSize = numElements * bytes;
        } else if (className && stmt.pointerDepth === 0) {
            allocSize = this.classLayouts.get(className)!.size;
        } else if (isMemLocal) {
            allocSize = 8;
        }

        if (allocSize > 0) {
          const ptrExpr = this.module.global.get("heap_ptr", binaryen.i32);
          const newHeapPtr = this.module.i32.add(ptrExpr, this.module.i32.const(allocSize));
          initExpr = this.module.block(null, [ this.module.global.set("heap_ptr", newHeapPtr), this.module.i64.extend_u(ptrExpr) ], binaryen.i64);
        }

        if (initExpr) blockStmts.push(this.module.local.set(index, initExpr));
      }
    }
    
    const bodyExprs = node.body.body.map(stmt => this.generateStatement(stmt));
    if (returnType === binaryen.none) bodyExprs.push(this.module.return());
    blockStmts.push(...bodyExprs);

    this.module.addFunction(node.name, binaryen.createType(paramTypes), returnType, localTypes, this.module.block(null, blockStmts));
    this.module.addFunctionExport(node.name, node.name);
  }

  private generateStatement(stmt: AST.Statement): binaryen.ExpressionRef {
    switch (stmt.type) {
      case "VariableDeclaration": {
        if (stmt.initializer) {
          const { index, type, isMemLocal, className } = this.currentLocals.get(stmt.name)!;
          
          if (stmt.initializer.type === "ArrayLiteral") {
            const ptr32 = this.module.i32.wrap(this.module.local.get(index, binaryen.i64));
            const stores = stmt.initializer.elements.map((el, i) => {
                const val = this.generateExpression(el);
                let bytes = 8;
                if (stmt.pointerDepth === 1 && (stmt.varType === "I8" || stmt.varType === "U8")) bytes = 1;
                else if (stmt.pointerDepth === 1 && (stmt.varType === "I16" || stmt.varType === "U16")) bytes = 2;
                else if (stmt.pointerDepth === 1 && (stmt.varType === "I32" || stmt.varType === "U32")) bytes = 4;
                
                const offset = i * bytes;
                if (bytes === 1) return this.module.i32.store8(offset, 1, ptr32, this.module.i32.wrap(val));
                if (bytes === 2) return this.module.i32.store16(offset, 2, ptr32, this.module.i32.wrap(val));
                if (bytes === 4) return this.module.i32.store(offset, 4, ptr32, this.module.i32.wrap(val));
                return this.module.i64.store(offset, 8, ptr32, val);
            });
            return this.module.block(null, stores, binaryen.none);
          }
          
          const initExpr = this.generateExpression(stmt.initializer, type);
          if (isMemLocal && !className && !stmt.arraySize) {
               const ptr32 = this.module.i32.wrap(this.module.local.get(index, binaryen.i64));
               const storeVal = type === binaryen.f64 ? this.module.i64.reinterpret(initExpr) : initExpr;
               return this.module.i64.store(0, 8, ptr32, storeVal);
          }
          return this.module.local.set(index, initExpr);
        }
        return this.module.nop();
      }
      case "ReturnStatement": {
        if (stmt.argument) {
          return this.module.return(this.generateExpression(stmt.argument));
        }
        return this.module.return();
      }
      case "ExpressionStatement": {
        const exprRef = this.generateExpression(stmt.expression);
        const type = binaryen.getExpressionInfo(exprRef).type;
        if (type === binaryen.none || type === binaryen.unreachable) {
          return exprRef;
        }
        return this.module.drop(exprRef);
      }
      case "IfStatement": {
        const test = this.generateExpression(stmt.test);
        const consequent = this.generateStatement(stmt.consequent);
        const alternate = stmt.alternate ? this.generateStatement(stmt.alternate) : undefined;
        // Wasm if expects i32 for condition. Since HolyC is all i64, we wrap it to i32.
        const condition = this.module.i32.wrap(test);
        return this.module.if(condition, consequent, alternate);
      }
      case "BlockStatement": {
        const exprs = stmt.body.map(s => this.generateStatement(s));
        return this.module.block(null, exprs);
      }
      case "ForStatement": {
        const exprs: binaryen.ExpressionRef[] = [];
        if (stmt.init) exprs.push(this.generateStatement(stmt.init));
        
        const loopName = `loop_${Math.floor(Math.random()*10000)}`;
        const blockName = `block_${Math.floor(Math.random()*10000)}`;
        
        const test = stmt.test ? this.module.i32.wrap(this.generateExpression(stmt.test, binaryen.i64)) : this.module.i32.const(1);
        
        let update = this.module.nop();
        if (stmt.update) {
            const updateExpr = this.generateExpression(stmt.update, binaryen.i64);
            const type = binaryen.getExpressionInfo(updateExpr).type;
            if (type !== binaryen.none && type !== binaryen.unreachable) update = this.module.drop(updateExpr);
            else update = updateExpr;
        }
        
        const body = this.generateStatement(stmt.body);
        
        const loopBody = this.module.block(blockName, [
          this.module.br(blockName, this.module.i32.eqz(test)),
          body,
          update,
          this.module.br(loopName)
        ]);
        
        exprs.push(this.module.loop(loopName, loopBody));
        return this.module.block(null, exprs);
      }
      default:
        throw new Error(`Code generation for statement type ${stmt.type} not implemented yet`);
    }
  }

  private generateExpression(expr: AST.Expression, expectedType?: binaryen.Type): binaryen.ExpressionRef {
    switch (expr.type) {
      case "NumberLiteral": {
        if (expectedType === binaryen.f64 || (expr.rawValue && expr.rawValue.includes('.')) || (!expr.rawValue && !Number.isInteger(expr.value))) {
          return this.module.f64.const(expr.value);
        }
        return this.module.i64.const(expr.rawValue ? BigInt(expr.rawValue) : BigInt(expr.value)); 
      }
      case "StringLiteral": {
        const ptr = parseInt(expr.rawValue!);
        return this.module.i64.const(BigInt(ptr));
      }
      case "Identifier": {
        if (this.currentLocals.has(expr.name)) {
          const { index, type, isMemLocal, className, arraySize } = this.currentLocals.get(expr.name)!;
          
          if (arraySize) {
             return this.module.local.get(index, binaryen.i64); // Arrays decay to pointers
          }
          
          if (isMemLocal && !className) {
             const ptr32 = this.module.i32.wrap(this.module.local.get(index, binaryen.i64));
             const load = this.module.i64.load(0, 8, ptr32);
             if (type === binaryen.f64) return this.module.f64.reinterpret(load);
             return load;
          }
          return this.module.local.get(index, type);
        }
        throw new Error(`Undefined identifier: ${expr.name}`);
      }
      case "BinaryExpression": {
        let left = this.generateExpression(expr.left);
        let right = this.generateExpression(expr.right);
        let isF64 = binaryen.getExpressionType(left) === binaryen.f64 || binaryen.getExpressionType(right) === binaryen.f64;
        
        if (isF64) {
           if (binaryen.getExpressionType(left) === binaryen.i64) left = this.module.f64.convert_s.i64(left);
           if (binaryen.getExpressionType(right) === binaryen.i64) right = this.module.f64.convert_s.i64(right);
        }

        // Pointer arithmetic scaling
        if (!isF64 && (expr.operator === "+" || expr.operator === "-")) {
           const checkPtr = (e: AST.Expression) => {
               if (e.type === "Identifier" && this.currentLocals.has(e.name)) {
                   const depth = this.currentLocals.get(e.name)!.pointerDepth || 0;
                   const type = this.currentLocals.get(e.name)!.holycType || "";
                   if (depth > 0) {
                      if (depth === 1 && (type === "I8" || type === "U8")) return 1;
                      if (depth === 1 && (type === "I16" || type === "U16")) return 2;
                      if (depth === 1 && (type === "I32" || type === "U32")) return 4;
                      return 8;
                   }
               }
               return 0;
           };
           const lBytes = checkPtr(expr.left);
           const rBytes = checkPtr(expr.right);
           
           if (lBytes > 1 && rBytes === 0) {
               right = this.module.i64.mul(right, this.module.i64.const(BigInt(lBytes)));
           } else if (rBytes > 1 && lBytes === 0 && expr.operator === "+") {
               left = this.module.i64.mul(left, this.module.i64.const(BigInt(rBytes)));
           }
        }
        
        switch (expr.operator) {
          case "+": return isF64 ? this.module.f64.add(left, right) : this.module.i64.add(left, right);
          case "-": return isF64 ? this.module.f64.sub(left, right) : this.module.i64.sub(left, right);
          case "*": return isF64 ? this.module.f64.mul(left, right) : this.module.i64.mul(left, right);
          case "/": return isF64 ? this.module.f64.div(left, right) : this.module.i64.div_s(left, right);
          case "%": 
            if (isF64) throw new Error("Modulo on floats not supported yet.");
            return this.module.i64.rem_s(left, right);
          case "|":
            if (isF64) throw new Error("Bitwise OR on floats not supported.");
            return this.module.i64.or(left, right);
          case "==": {
            const eq = isF64 ? this.module.f64.eq(left, right) : this.module.i64.eq(left, right);
            return this.module.i64.extend_u(eq);
          }
          case "!=": {
            const ne = isF64 ? this.module.f64.ne(left, right) : this.module.i64.ne(left, right);
            return this.module.i64.extend_u(ne);
          }
          case "<": {
            const lt = isF64 ? this.module.f64.lt(left, right) : this.module.i64.lt_s(left, right);
            return this.module.i64.extend_u(lt);
          }
          case "<=": {
            const le = isF64 ? this.module.f64.le(left, right) : this.module.i64.le_s(left, right);
            return this.module.i64.extend_u(le);
          }
          case ">": {
            const gt = isF64 ? this.module.f64.gt(left, right) : this.module.i64.gt_s(left, right);
            return this.module.i64.extend_u(gt);
          }
          case ">=": {
            const ge = isF64 ? this.module.f64.ge(left, right) : this.module.i64.ge_s(left, right);
            return this.module.i64.extend_u(ge);
          }
          case "&&": {
            const lBool = this.module.i64.extend_u(this.module.i64.ne(left, this.module.i64.const(0n)));
            const rBool = this.module.i64.extend_u(this.module.i64.ne(right, this.module.i64.const(0n)));
            return this.module.i64.and(lBool, rBool);
          }
          case "||": {
            const lBool = this.module.i64.extend_u(this.module.i64.ne(left, this.module.i64.const(0n)));
            const rBool = this.module.i64.extend_u(this.module.i64.ne(right, this.module.i64.const(0n)));
            return this.module.i64.or(lBool, rBool);
          }
          default: throw new Error(`Operator ${expr.operator} not implemented`);
        }
      }
      case "UnaryExpression": {
        if (expr.operator === "*") {
          const ptrExpr = this.generateExpression(expr.argument);
          const ptr32 = this.module.i32.wrap(ptrExpr);
          // offset=0, align=8
          return this.module.i64.load(0, 8, ptr32);
        }
        if (expr.operator === "&") {
          if (expr.argument.type === "Identifier" && this.currentLocals.has(expr.argument.name)) {
             const { index, isMemLocal, className } = this.currentLocals.get(expr.argument.name)!;
             if (isMemLocal || className) return this.module.local.get(index, binaryen.i64);
          }
          return this.module.i64.const(BigInt(0x20000));
        }
        throw new Error(`Unary operator ${expr.operator} not implemented`);
      }
      case "MemberExpression": {
        const objectExpr = this.generateExpression(expr.object, binaryen.i64);
        let className = "";
        if (expr.object.type === "Identifier") {
           if (this.currentLocals.has(expr.object.name)) className = this.currentLocals.get(expr.object.name)!.holycType || "";
           else if (this.globalTypes.has(expr.object.name)) className = this.globalTypes.get(expr.object.name)!.holycType || "";
        }
        if (!className || !this.classLayouts.has(className)) throw new Error("Unknown class type for member access");
        const layout = this.classLayouts.get(className)!;
        const member = layout.members.get(expr.property);
        if (!member) throw new Error(`Member ${expr.property} not found`);
        
        const ptr32 = this.module.i32.wrap(objectExpr);
        const offsetPtr = this.module.i32.add(ptr32, this.module.i32.const(member.offset));
        return this.module.i64.load(0, 8, offsetPtr);
      }
      case "IndexExpression": {
        const objectExpr = this.generateExpression(expr.object, binaryen.i64);
        const indexExpr = this.generateExpression(expr.index, binaryen.i64);
        
        let holycType = "";
        if (expr.object.type === "Identifier") {
           if (this.currentLocals.has(expr.object.name)) holycType = this.currentLocals.get(expr.object.name)!.holycType || "";
           else if (this.globalTypes.has(expr.object.name)) holycType = this.globalTypes.get(expr.object.name)!.holycType || "";
        }
        
        const ptr32 = this.module.i32.wrap(objectExpr);
        const index32 = this.module.i32.wrap(indexExpr);
        
        let bytes = 8;
        let pointerDepth = 0;
        if (expr.object.type === "Identifier") {
           if (this.currentLocals.has(expr.object.name)) pointerDepth = this.currentLocals.get(expr.object.name)!.pointerDepth || 0;
           else if (this.globalTypes.has(expr.object.name)) pointerDepth = this.globalTypes.get(expr.object.name)!.pointerDepth || 0;
        }
        
        if (pointerDepth <= 1 && (holycType === "U8" || holycType === "I8")) bytes = 1;
        else if (pointerDepth <= 1 && (holycType === "U16" || holycType === "I16")) bytes = 2;
        else if (pointerDepth <= 1 && (holycType === "U32" || holycType === "I32")) bytes = 4;
        
        const byteOffset = bytes === 1 ? index32 : this.module.i32.mul(index32, this.module.i32.const(bytes));
        const finalPtr = this.module.i32.add(ptr32, byteOffset);
        
        if (bytes === 1) return this.module.i64.extend_u(this.module.i32.load8_u(0, 1, finalPtr));
        if (bytes === 2) return this.module.i64.extend_u(this.module.i32.load16_u(0, 2, finalPtr));
        if (bytes === 4) return this.module.i64.extend_u(this.module.i32.load(0, 4, finalPtr));
        return this.module.i64.load(0, 8, finalPtr);
      }
      case "AssignmentExpression": {
        const right = this.generateExpression(expr.right);
        if (expr.left.type === "Identifier") {
          if (this.currentLocals.has(expr.left.name)) {
            const { index, type, isMemLocal, className } = this.currentLocals.get(expr.left.name)!;
            if (isMemLocal && !className) {
               const ptr32 = this.module.i32.wrap(this.module.local.get(index, binaryen.i64));
               const storeVal = type === binaryen.f64 ? this.module.i64.reinterpret(right) : right;
               return this.module.block(null, [
                 this.module.i64.store(0, 8, ptr32, storeVal),
                 right
               ], type);
            }
            return this.module.local.tee(index, right, type);
          }
        } else if (expr.left.type === "UnaryExpression" && expr.left.operator === "*") {
          const ptrExpr = this.generateExpression(expr.left.argument);
          const ptr32 = this.module.i32.wrap(ptrExpr);
          return this.module.block(null, [
             this.module.i64.store(0, 8, ptr32, right),
             this.module.i64.const(0n)
          ], binaryen.i64);
        } else if (expr.left.type === "MemberExpression") {
          let className = "";
          if (expr.left.object.type === "Identifier") {
             if (this.currentLocals.has(expr.left.object.name)) className = this.currentLocals.get(expr.left.object.name)!.holycType || "";
             else if (this.globalTypes.has(expr.left.object.name)) className = this.globalTypes.get(expr.left.object.name)!.holycType || "";
          }
          const layout = this.classLayouts.get(className)!;
          const member = layout.members.get(expr.left.property)!;
          const ptr32 = this.module.i32.wrap(this.generateExpression(expr.left.object));
          const offsetPtr = this.module.i32.add(ptr32, this.module.i32.const(member.offset));
          return this.module.block(null, [ this.module.i64.store(0, 8, offsetPtr, right), right ], binaryen.i64);
        }
        throw new Error(`Complex assignment not fully implemented yet`);
      }
      case "CallExpression": {
        let args = expr.arguments.map(arg => this.generateExpression(arg));
        let callee = expr.callee;
        if (callee === "Print") {
           callee = `Print${args.length - 1}`;
           // Wasm expects f64 values to be passed as f64 or bitcast to i64?
           // Since our Print1,2,3,4 imports take i64, we need to reinterpret f64 to i64!
           args = args.map(arg => {
              const t = binaryen.getExpressionType(arg);
              if (t === binaryen.f64) return this.module.i64.reinterpret(arg);
              return arg;
           });
        }
        
        if (callee.startsWith("Print") || callee === "GrLine") {
          return this.module.call(callee, args, binaryen.none);
        }
        
        const funcDecl = this.functions.get(callee);
        if (funcDecl) {
            // Fill default arguments
            while (args.length < funcDecl.params.length) {
                const p = funcDecl.params[args.length]!;
                if (p.defaultValue) {
                    args.push(this.generateExpression(p.defaultValue));
                } else {
                    args.push(this.module.i64.const(0n));
                }
            }
            // ensure all args are correctly typed, casting to i64 if f64 but expecting i64
            args = args.map((arg, i) => {
               const param = funcDecl.params[i]!;
               const expected = this.mapType(param.varType, param.pointerDepth);
               const actual = binaryen.getExpressionType(arg);
               if (expected === binaryen.f64 && actual === binaryen.i64) return this.module.f64.convert_s.i64(arg);
               if (expected === binaryen.i64 && actual === binaryen.f64) return this.module.i64.trunc_s.f64(arg);
               return arg;
            });
            const retType = this.mapType(funcDecl.returnType);
            return this.module.call(callee, args, retType);
        }
        
        return this.module.call(callee, args, binaryen.i64);
      }
      default:
        throw new Error(`Code generation for expression type ${(expr as any).type} not implemented yet`);
    }
  }
}

