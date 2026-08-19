import binaryen from "binaryen";
import * as AST from "./ast.js";

export class Generator {
  public module: binaryen.Module;
  private currentLocals = new Map<string, number>();
  private stringTable: { offset: number, data: Uint8Array }[] = [];
  private staticDataPtr = 0x10000;
  
  constructor() {
    this.module = new binaryen.Module();
    // We will set memory in generate() once we know all strings
    
    // Import host functions
    this.module.addFunctionImport("Print", "env", "Print", binaryen.createType([binaryen.i64]), binaryen.none);
    this.module.addFunctionImport("GrLine", "env", "GrLine", binaryen.createType([binaryen.i64, binaryen.i64, binaryen.i64, binaryen.i64]), binaryen.none);
  }

  private mapType(type: AST.Type): binaryen.Type {
    switch (type) {
      case "U0": return binaryen.none;
      case "I64": return binaryen.i64;
      case "F64": return binaryen.f64;
      case "I8":
      case "U8": return binaryen.i32; // Local vars are i32 for 8-bit types
      default: throw new Error(`Unsupported type: ${type}`);
    }
  }

  public generate(program: AST.Program): Uint8Array {
    for (const stmt of program.body) {
      if (stmt.type === "FunctionDeclaration") {
        this.generateFunction(stmt);
      }
      // TODO: Handle global variables
    }

    // Set memory and export it so the Runtime can access the strings we baked into it.
    const segments = this.stringTable.map(s => ({
      offset: this.module.i32.const(s.offset),
      data: s.data,
      passive: false
    }));
    this.module.setMemory(10, 256, "memory", segments, false);

    if (!this.module.validate()) {
      throw new Error("Binaryen validation failed! The generated Wasm is invalid.");
    }

    return this.module.emitBinary();
  }

  private generateFunction(node: AST.FunctionDeclaration) {
    const returnType = this.mapType(node.returnType);
    this.currentLocals.clear();

    const localTypes: binaryen.Type[] = [];
    
    // Pass 1: Extract all local variables in the function to declare them upfront
    const extractLocals = (stmt: AST.Statement) => {
      if (stmt.type === "VariableDeclaration") {
        this.currentLocals.set(stmt.name, localTypes.length);
        localTypes.push(this.mapType(stmt.varType));
      } else if (stmt.type === "BlockStatement") {
        stmt.body.forEach(extractLocals);
      } else if (stmt.type === "IfStatement") {
        extractLocals(stmt.consequent);
        if (stmt.alternate) extractLocals(stmt.alternate);
      } else if (stmt.type === "WhileStatement" || stmt.type === "ForStatement") {
        extractLocals(stmt.body);
      }
    };
    extractLocals(node.body);

    // Pass 2: Generate the body
    const bodyExprs = node.body.body.map(stmt => this.generateStatement(stmt));
    
    // Add implicit return for U0 functions if they don't have one
    if (returnType === binaryen.none) {
      bodyExprs.push(this.module.return());
    }

    this.module.addFunction(
      node.name,
      binaryen.createType([]), // No arguments for now
      returnType,
      localTypes,
      this.module.block(null, bodyExprs)
    );
    
    this.module.addFunctionExport(node.name, node.name);
  }

  private generateStatement(stmt: AST.Statement): binaryen.ExpressionRef {
    switch (stmt.type) {
      case "VariableDeclaration": {
        if (stmt.initializer) {
          const index = this.currentLocals.get(stmt.name)!;
          return this.module.local.set(index, this.generateExpression(stmt.initializer));
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
      default:
        throw new Error(`Code generation for statement type ${stmt.type} not implemented yet`);
    }
  }

  private generateExpression(expr: AST.Expression): binaryen.ExpressionRef {
    switch (expr.type) {
      case "NumberLiteral": {
        return this.module.i64.const(BigInt(expr.value)); 
      }
      case "StringLiteral": {
        const encoder = new TextEncoder();
        // Add actual null terminator!
        const data = encoder.encode(expr.value + "\0");
        const ptr = this.staticDataPtr;
        this.stringTable.push({ offset: ptr, data });
        this.staticDataPtr += data.length;
        
        return this.module.i64.const(BigInt(ptr));
      }
      case "Identifier": {
        if (this.currentLocals.has(expr.name)) {
          const index = this.currentLocals.get(expr.name)!;
          // Local is I64 (mostly)
          return this.module.local.get(index, binaryen.i64);
        }
        throw new Error(`Undefined identifier: ${expr.name}`);
      }
      case "BinaryExpression": {
        const left = this.generateExpression(expr.left);
        const right = this.generateExpression(expr.right);
        
        switch (expr.operator) {
          case "+": return this.module.i64.add(left, right);
          case "-": return this.module.i64.sub(left, right);
          case "*": return this.module.i64.mul(left, right);
          case "/": return this.module.i64.div_s(left, right);
          case "==": return this.module.i64.extend_u(this.module.i64.eq(left, right));
          case "!=": return this.module.i64.extend_u(this.module.i64.ne(left, right));
          case "<": return this.module.i64.extend_u(this.module.i64.lt_s(left, right));
          case ">": return this.module.i64.extend_u(this.module.i64.gt_s(left, right));
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
        throw new Error(`Unary operator ${expr.operator} not implemented`);
      }
      case "AssignmentExpression": {
        if (expr.left.type === "Identifier") {
          if (this.currentLocals.has(expr.left.name)) {
            const index = this.currentLocals.get(expr.left.name)!;
            const right = this.generateExpression(expr.right);
            return this.module.local.tee(index, right, binaryen.i64);
          }
        } else if (expr.left.type === "UnaryExpression" && expr.left.operator === "*") {
          const ptrExpr = this.generateExpression(expr.left.argument);
          const valueExpr = this.generateExpression(expr.right);
          const ptr32 = this.module.i32.wrap(ptrExpr);
          
          return this.module.block(null, [
             this.module.i64.store(0, 8, ptr32, valueExpr),
             // In C, assignment evaluates to the assigned value, but a block returning the value requires local variables.
             // For simplicity, we just return a dummy 0n if this is nested. It is usually dropped.
             this.module.i64.const(0n)
          ], binaryen.i64);
        }
        throw new Error(`Complex assignment not fully implemented yet`);
      }
      case "CallExpression": {
        if (expr.callee === "Print" || expr.callee === "GrLine") {
          const args = expr.arguments.map(arg => this.generateExpression(arg));
          // Print takes 1 arg (string pointer). GrLine takes 4 args.
          // Note: In Phase 5, we expect strings to be pointers. 
          // If argument is a StringLiteral, we should ideally allocate it in the data segment.
          // For now, we will handle strings by allocating them in the static memory area and returning their pointer.
          return this.module.call(expr.callee, args, binaryen.none);
        }
        console.warn(`Function calls like ${expr.callee} not fully linked yet. Returning dummy 0.`);
        return this.module.i64.const(0n);
      }
      default:
        throw new Error(`Code generation for expression type ${(expr as any).type} not implemented yet`);
    }
  }
}
