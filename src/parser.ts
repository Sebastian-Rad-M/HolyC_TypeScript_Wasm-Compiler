import type { Token } from "./lexer.js";
import { TokenType } from "./lexer.js";
import * as AST from "./ast.js";

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`Parse Error: ${message} at line ${this.peek().line}, col ${this.peek().column}`);
  }

  // ==== Parsing Logic ====

  public parse(): AST.Program {
    const statements: AST.Statement[] = [];
    while (!this.isAtEnd()) {
      // Skip directives for now in the parser
      if (this.match(TokenType.Directive)) {
        // Skip until we see matching brackets or just skip the statement
        // For #exe { ... } we might just skip the block.
        if (this.match(TokenType.OpenBrace)) {
          let depth = 1;
          while (depth > 0 && !this.isAtEnd()) {
            if (this.match(TokenType.OpenBrace)) depth++;
            else if (this.match(TokenType.CloseBrace)) depth--;
            else this.advance();
          }
        }
        continue;
      }
      const decl = this.declaration();
      if (Array.isArray(decl)) statements.push(...decl);
      else statements.push(decl as AST.Statement);
    }
    return { type: "Program", body: statements };
  }

  private definedTypes = new Set<string>();

  private isType(token: Token): boolean {
    if ([TokenType.U0, TokenType.I64, TokenType.U64, TokenType.F64, TokenType.I32, TokenType.U32, TokenType.I16, TokenType.U16, TokenType.I8, TokenType.U8].includes(token.type)) return true;
    if (token.type === TokenType.Identifier && this.definedTypes.has(token.value)) return true;
    return false;
  }

  private parseType(): AST.Type {
    const typeToken = this.advance();
    return typeToken.value as AST.Type;
  }

  private declaration(): AST.Statement | AST.Statement[] {
    if (this.match(TokenType.HashExe)) {
      this.consume(TokenType.OpenBrace, "Expected '{' after #exe");
      let bodyText = "";
      while (!this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
        const tok = this.advance();
        if (tok.type === TokenType.String) bodyText += '"' + tok.value.replace(/\n/g, "\\n") + '" ';
        else bodyText += tok.value + " ";
      }
      this.consume(TokenType.CloseBrace, "Expected '}' after #exe block");
      let result: any = undefined;
      const Yield = (val: any) => { result = val; };
      try {
        const ev = eval(bodyText);
        if (typeof ev === "string" && result === undefined) console.log(ev);
      } catch (e) { console.error("Error evaluating #exe:", e); }
      return { type: "BlockStatement", body: [] };
    }

    if (this.match(TokenType.Class) || this.match(TokenType.Union)) {
      const isUnion = this.previous().type === TokenType.Union;
      const name = this.consume(TokenType.Identifier, "Expected class/union name.").value;
      this.definedTypes.add(name);
      this.consume(TokenType.OpenBrace, "Expected '{' before body.");
      const members: AST.VariableDeclaration[] = [];
      while (!this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
        const typeStr = this.parseType();
        let memPointerDepth = 0;
        while (this.match(TokenType.Star)) memPointerDepth++;
        const memName = this.consume(TokenType.Identifier, "Expected member name.").value;
        
        let arraySize: AST.Expression | undefined = undefined;
        while (this.match(TokenType.OpenBracket)) {
           if (!this.check(TokenType.CloseBracket)) {
               arraySize = this.expression();
           }
           this.consume(TokenType.CloseBracket, "Expected ']'");
           memPointerDepth++;
        }
        this.consume(TokenType.Semicolon, "Expected ';' after member.");
        members.push({ type: "VariableDeclaration", varType: typeStr, name: memName, initializer: null, pointerDepth: memPointerDepth, arraySize } as any);
      }
      this.consume(TokenType.CloseBrace, "Expected '}' after body.");
      this.consume(TokenType.Semicolon, "Expected ';' after declaration.");
      return { type: "ClassDeclaration", name, members, isUnion };
    }

    if (this.isType(this.peek())) {
      const typeStr = this.parseType();
      
      let firstPointerDepth = 0;
      while (this.match(TokenType.Star)) firstPointerDepth++;
      
      let isFuncPtr = false;
      let firstName = "";
      if (this.match(TokenType.OpenParen)) {
         while (this.match(TokenType.Star)) firstPointerDepth++;
         firstName = this.consume(TokenType.Identifier, "Expected identifier in function pointer.").value;
         this.consume(TokenType.CloseParen, "Expected ')' after function pointer identifier.");
         this.consume(TokenType.OpenParen, "Expected '(' for function pointer parameters.");
         while (!this.check(TokenType.CloseParen) && !this.isAtEnd()) {
            this.advance(); 
         }
         this.consume(TokenType.CloseParen, "Expected ')' after function pointer parameters.");
         isFuncPtr = true;
      } else {
         firstName = this.consume(TokenType.Identifier, "Expected identifier after type.").value;
      }
      
      let funcPointerDepth = firstPointerDepth;
      let arraySize: AST.Expression | undefined = undefined;
      while (this.match(TokenType.OpenBracket)) {
         if (!this.check(TokenType.CloseBracket)) {
             arraySize = this.expression();
         }
         this.consume(TokenType.CloseBracket, "Expected ']'");
         funcPointerDepth++;
      }
      
      if (!isFuncPtr && this.match(TokenType.OpenParen)) {
        // Function Declaration
        const params: AST.Parameter[] = [];
        if (!this.check(TokenType.CloseParen)) {
          do {
            if (this.isType(this.peek())) {
              const pType = this.parseType();
              let pPointerDepth = 0;
              while (this.match(TokenType.Star)) pPointerDepth++;
              
              const pName = this.consume(TokenType.Identifier, "Expected parameter name.").value;
              while (this.match(TokenType.OpenBracket)) {
                 this.consume(TokenType.CloseBracket, "Expected ']'");
                 pPointerDepth++;
              }
              
              let defaultValue: AST.Expression | null = null;
              if (this.match(TokenType.Equals)) {
                defaultValue = this.expression();
              }
              params.push({ varType: pType, name: pName, pointerDepth: pPointerDepth, defaultValue });
            } else {
               throw new Error(`Expected parameter type at line ${this.peek().line}`);
            }
          } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.CloseParen, "Expected ')' after parameters.");
        const body = this.blockStatement();
        return {
          type: "FunctionDeclaration",
          returnType: typeStr,
          name: firstName,
          params,
          body
        };
      }
      
      const decls: AST.Statement[] = [];
      let currentPointerDepth = funcPointerDepth;
      let currentName = firstName;
      
      while (true) {
        let initializer: AST.Expression | null = null;
        if (this.match(TokenType.Equals)) {
          initializer = this.expression();
        }
        decls.push({
          type: "VariableDeclaration",
          varType: typeStr,
          name: currentName,
          initializer,
          pointerDepth: currentPointerDepth,
          arraySize
        } as any);
        
        if (this.match(TokenType.Comma)) {
           currentPointerDepth = 0;
           while (this.match(TokenType.Star)) currentPointerDepth++;
           currentName = this.consume(TokenType.Identifier, "Expected identifier after comma.").value;
           arraySize = undefined;
           while (this.match(TokenType.OpenBracket)) {
              if (!this.check(TokenType.CloseBracket)) {
                  arraySize = this.expression();
              }
              this.consume(TokenType.CloseBracket, "Expected ']'");
              currentPointerDepth++;
           }
           continue;
        }
        break;
      }
      
      this.consume(TokenType.Semicolon, "Expected ';' after variable declaration.");
      return decls;
    }

    return this.statement();
  }

  private statement(): AST.Statement {
    if (this.match(TokenType.If)) return this.ifStatement();
    if (this.match(TokenType.While)) return this.whileStatement();
    if (this.match(TokenType.For)) return this.forStatement();
    if (this.match(TokenType.Switch)) return this.switchStatement();
    if (this.match(TokenType.Return)) return this.returnStatement();
    if (this.match(TokenType.Break)) {
       this.consume(TokenType.Semicolon, "Expected ';' after break.");
       return { type: "BreakStatement" };
    }
    if (this.match(TokenType.Try)) return this.tryStatement();
    if (this.match(TokenType.Throw)) return this.throwStatement();
    if (this.check(TokenType.OpenBrace)) return this.blockStatement();

    return this.expressionStatement();
  }

  private ifStatement(): AST.IfStatement {
    this.consume(TokenType.OpenParen, "Expected '(' after 'if'.");
    const test = this.expression();
    this.consume(TokenType.CloseParen, "Expected ')' after if condition.");
    
    const consequent = this.statement();
    let alternate: AST.Statement | null = null;
    if (this.match(TokenType.Else)) {
      alternate = this.statement();
    }

    return { type: "IfStatement", test, consequent, alternate };
  }

  private whileStatement(): AST.WhileStatement {
    this.consume(TokenType.OpenParen, "Expected '(' after 'while'.");
    const test = this.expression();
    this.consume(TokenType.CloseParen, "Expected ')' after while condition.");
    const body = this.statement();

    return { type: "WhileStatement", test, body };
  }

  private forStatement(): AST.ForStatement {
    this.consume(TokenType.OpenParen, "Expected '(' after 'for'.");
    
    let init: AST.Statement | null = null;
    if (!this.match(TokenType.Semicolon)) {
      if (this.isType(this.peek())) {
        const decl = this.declaration();
        if (Array.isArray(decl)) init = { type: "BlockStatement", body: decl };
        else init = decl as AST.Statement;
      } else {
        init = this.expressionStatement();
      }
    }

    let test: AST.Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      test = this.expression();
    }
    this.consume(TokenType.Semicolon, "Expected ';' after loop condition.");

    let update: AST.Expression | null = null;
    if (!this.check(TokenType.CloseParen)) {
      update = this.expression();
    }
    this.consume(TokenType.CloseParen, "Expected ')' after for clauses.");

    const body = this.statement();
    return { type: "ForStatement", init, test, update, body };
  }

  private switchStatement(): AST.SwitchStatement {
    this.consume(TokenType.OpenParen, "Expected '(' after 'switch'.");
    const discriminant = this.expression();
    this.consume(TokenType.CloseParen, "Expected ')' after switch value.");
    this.consume(TokenType.OpenBrace, "Expected '{' before switch body.");

    const cases: AST.SwitchCase[] = [];
    while (!this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
      if (this.match(TokenType.Case)) {
        const test = this.expression();
        let rangeEnd: AST.Expression | null = null;
        if (this.match(TokenType.Ellipsis)) {
           rangeEnd = this.expression();
        }
        this.consume(TokenType.Colon, "Expected ':' after case value.");
        
        const consequent: AST.Statement[] = [];
        while (!this.check(TokenType.Case) && !this.check(TokenType.Default) && !this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
          const decl = this.declaration();
          if (Array.isArray(decl)) consequent.push(...decl);
          else consequent.push(decl as AST.Statement);
        }
        cases.push({ type: "SwitchCase", test, rangeEnd, consequent });
      } else if (this.match(TokenType.Default)) {
        this.consume(TokenType.Colon, "Expected ':' after default.");
        const consequent: AST.Statement[] = [];
        while (!this.check(TokenType.Case) && !this.check(TokenType.Default) && !this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
          const decl = this.declaration();
          if (Array.isArray(decl)) consequent.push(...decl);
          else consequent.push(decl as AST.Statement);
        }
        cases.push({ type: "SwitchCase", test: null, consequent });
      } else {
        throw new Error(`Expected 'case' or 'default' inside switch, got ${this.peek().type} at line ${this.peek().line}`);
      }
    }
    this.consume(TokenType.CloseBrace, "Expected '}' after switch body.");
    return { type: "SwitchStatement", discriminant, cases };
  }

  private returnStatement(): AST.ReturnStatement {
    let value: AST.Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      value = this.expression();
    }
    this.consume(TokenType.Semicolon, "Expected ';' after return value.");
    return { type: "ReturnStatement", argument: value };
  }

  private tryStatement(): AST.TryStatement {
    const block = this.blockStatement();
    this.consume(TokenType.Catch, "Expected 'catch' after 'try' block.");
    const handler = this.blockStatement();
    return { type: "TryStatement", block, handler };
  }

  private throwStatement(): AST.ThrowStatement {
    this.consume(TokenType.Semicolon, "Expected ';' after 'throw'.");
    return { type: "ThrowStatement" };
  }



  private blockStatement(): AST.BlockStatement {
    this.consume(TokenType.OpenBrace, "Expected '{' before block.");
    const statements: AST.Statement[] = [];
    while (!this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
      const decl = this.declaration();
      if (Array.isArray(decl)) statements.push(...decl);
      else statements.push(decl as AST.Statement);
    }
    this.consume(TokenType.CloseBrace, "Expected '}' after block.");
    return { type: "BlockStatement", body: statements };
  }

  private expressionStatement(): AST.ExpressionStatement {
    const expr = this.expression();
    
    // HolyC Quirk: If expr is a StringLiteral and we have commas, it's a Print call!
    if (expr.type === "StringLiteral" && this.check(TokenType.Comma)) {
        const args: AST.Expression[] = [expr];
        while (this.match(TokenType.Comma)) {
            args.push(this.expression());
        }
        this.consume(TokenType.Semicolon, "Expected ';' after implicit Print statement.");
        return { type: "ExpressionStatement", expression: { type: "CallExpression", callee: "Print", arguments: args } };
    }
    
    this.consume(TokenType.Semicolon, "Expected ';' after expression.");
    
    // HolyC Quirk: Just a string literal prints it.
    if (expr.type === "StringLiteral") {
        return { type: "ExpressionStatement", expression: { type: "CallExpression", callee: "Print", arguments: [expr] } };
    }
    
    // HolyC Quirk: Bare identifiers are function calls
    if (expr.type === "Identifier") {
        return { type: "ExpressionStatement", expression: { type: "CallExpression", callee: expr.name, arguments: [] } };
    }
    
    return { type: "ExpressionStatement", expression: expr };
  }

  // ==== Expressions (Precedence) ====

  private expression(): AST.Expression {
    return this.assignment();
  }

  private assignment(): AST.Expression {
    const expr = this.logicalOr();

    if (this.match(TokenType.PlusPlus)) {
      if (expr.type === "Identifier" || expr.type === "UnaryExpression") {
        return { type: "AssignmentExpression", left: expr, operator: "=", right: { type: "BinaryExpression", operator: "+", left: expr, right: { type: "NumberLiteral", value: 1, rawValue: "1" } } };
      }
      throw new Error("Invalid assignment target for ++");
    }
    if (this.match(TokenType.MinusMinus)) {
      if (expr.type === "Identifier" || expr.type === "UnaryExpression") {
        return { type: "AssignmentExpression", left: expr, operator: "=", right: { type: "BinaryExpression", operator: "-", left: expr, right: { type: "NumberLiteral", value: 1, rawValue: "1" } } };
      }
      throw new Error("Invalid assignment target for --");
    }

    if (this.match(TokenType.Equals, TokenType.PlusEquals, TokenType.MinusEquals)) {
      const op = this.previous();
      const value = this.assignment();
      
      if (expr.type === "Identifier" || expr.type === "UnaryExpression" || expr.type === "MemberExpression") {
        if (op.type === TokenType.PlusEquals || op.type === TokenType.MinusEquals) {
           const binOp = op.type === TokenType.PlusEquals ? "+" : "-";
           return {
             type: "AssignmentExpression",
             left: expr,
             operator: "=",
             right: { type: "BinaryExpression", operator: binOp, left: expr, right: value }
           };
        }
        return {
          type: "AssignmentExpression",
          left: expr,
          operator: "=",
          right: value
        };
      }
      throw new Error(`Invalid assignment target at line ${op.line}`);
    }

    return expr;
  }

  private parseBinary(next: () => AST.Expression, ...ops: TokenType[]): AST.Expression {
    let expr = next.call(this);
    while (this.match(...ops)) {
      expr = { type: "BinaryExpression", operator: this.previous().value, left: expr, right: next.call(this) };
    }
    return expr;
  }

  private logicalOr(): AST.Expression { return this.parseBinary(this.logicalAnd, TokenType.LogicalOr); }
  private logicalAnd(): AST.Expression { return this.parseBinary(this.bitwiseOr, TokenType.LogicalAnd); }
  private bitwiseOr(): AST.Expression { return this.parseBinary(this.equality, TokenType.BitwiseOr); }
  private equality(): AST.Expression { return this.parseBinary(this.comparison, TokenType.DoubleEquals, TokenType.NotEquals); }
  private comparison(): AST.Expression { return this.parseBinary(this.bitwiseShift, TokenType.LessThan, TokenType.LessEqual, TokenType.GreaterThan, TokenType.GreaterEqual); }
  private bitwiseShift(): AST.Expression { return this.parseBinary(this.term, TokenType.LeftShift, TokenType.RightShift); }
  private term(): AST.Expression { return this.parseBinary(this.factor, TokenType.Minus, TokenType.Plus); }
  private factor(): AST.Expression { return this.parseBinary(this.unary, TokenType.Slash, TokenType.Star, TokenType.Modulo); }

  private unary(): AST.Expression {
    if (this.match(TokenType.PlusPlus, TokenType.MinusMinus, TokenType.Bang, TokenType.Minus, TokenType.Star, TokenType.Ampersand)) {
      const operator = this.previous().value;
      const right = this.unary();
      
      if (operator === "++" || operator === "--") {
         const binOp = operator === "++" ? "+" : "-";
         return {
           type: "AssignmentExpression",
           left: right,
           operator: "=",
           right: { type: "BinaryExpression", operator: binOp, left: right, right: { type: "NumberLiteral", value: 1, rawValue: "1" } }
         };
      }
      
      return { type: "UnaryExpression", operator, argument: right };
    }
    return this.call();
  }

  private call(): AST.Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.OpenParen)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.Dot, TokenType.Arrow)) {
        const isArrow = this.previous().type === TokenType.Arrow;
        const property = this.consume(TokenType.Identifier, `Expected property name after '${isArrow ? "->" : "."}'.`);
        expr = { type: "MemberExpression", object: expr, property: property.value, isArrow };
      } else if (this.match(TokenType.OpenBracket)) {
        const index = this.expression();
        this.consume(TokenType.CloseBracket, "Expected ']' after index.");
        expr = { type: "IndexExpression", object: expr, index };
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: AST.Expression): AST.Expression {
    const args: AST.Expression[] = [];
    if (!this.check(TokenType.CloseParen)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.Comma));
    }
    this.consume(TokenType.CloseParen, "Expected ')' after arguments.");
    
    if (callee.type !== "Identifier") {
      throw new Error(`Can only call identifiers, line ${this.previous().line}`);
    }

    return {
      type: "CallExpression",
      callee: callee.name,
      arguments: args
    };
  }

  private primary(): AST.Expression {
    if (this.match(TokenType.OpenBrace)) {
      const elements: AST.Expression[] = [];
      if (!this.check(TokenType.CloseBrace)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.Comma));
      }
      this.consume(TokenType.CloseBrace, "Expected '}' after array literal.");
      return { type: "ArrayLiteral", elements };
    }

    if (this.match(TokenType.Number)) {
      const raw = this.previous().value;
      return { type: "NumberLiteral", value: Number(raw), rawValue: raw };
    }

    if (this.match(TokenType.String)) {
      return { type: "StringLiteral", value: this.previous().value };
    }

    if (this.match(TokenType.Identifier)) {
      return { type: "Identifier", name: this.previous().value };
    }

    if (this.match(TokenType.OpenParen)) {
      const expr = this.expression();
      this.consume(TokenType.CloseParen, "Expected ')' after expression.");
      return expr;
    }

    if (this.match(TokenType.HashExe)) {
      this.consume(TokenType.OpenBrace, "Expected '{' after #exe");
      let bodyText = "";
      while (!this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
        const tok = this.advance();
        if (tok.type === TokenType.String) bodyText += '"' + tok.value.replace(/\n/g, "\\n") + '" ';
        else bodyText += tok.value + " ";
      }
      this.consume(TokenType.CloseBrace, "Expected '}' after #exe block");
      let result: any = undefined;
      const Yield = (val: any) => { result = val; };
      try {
        const ev = eval(bodyText);
        if (typeof ev === "string" && result === undefined) console.log(ev);
      } catch (e) { console.error("Error evaluating #exe:", e); }
      if (result !== undefined) {
        if (typeof result === "number") return { type: "NumberLiteral", value: result, rawValue: result.toString() };
        if (typeof result === "string") return { type: "StringLiteral", value: result };
      }
      return { type: "NumberLiteral", value: 0, rawValue: "0" };
    }

    throw new Error(`Expected expression at line ${this.peek().line}, col ${this.peek().column}, got ${this.peek().type}`);
  }
}
