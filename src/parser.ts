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
      statements.push(this.declaration());
    }
    return { type: "Program", body: statements };
  }

  private isType(type: TokenType): boolean {
    return [TokenType.U0, TokenType.I64, TokenType.F64, TokenType.I8, TokenType.U8].includes(type);
  }

  private parseType(): AST.Type {
    const typeToken = this.advance();
    return typeToken.value as AST.Type;
  }

  private declaration(): AST.Statement {
    if (this.isType(this.peek().type)) {
      const typeStr = this.parseType();
      const name = this.consume(TokenType.Identifier, "Expected identifier after type.").value;

      if (this.match(TokenType.OpenParen)) {
        // Function Declaration
        this.consume(TokenType.CloseParen, "Expected ')' after parameters.");
        const body = this.blockStatement();
        return {
          type: "FunctionDeclaration",
          returnType: typeStr,
          name: name,
          body: body
        };
      } else {
        // Variable Declaration
        let initializer: AST.Expression | null = null;
        if (this.match(TokenType.Equals)) {
          initializer = this.expression();
        }
        this.consume(TokenType.Semicolon, "Expected ';' after variable declaration.");
        return {
          type: "VariableDeclaration",
          varType: typeStr,
          name: name,
          initializer: initializer
        };
      }
    }

    return this.statement();
  }

  private statement(): AST.Statement {
    if (this.match(TokenType.If)) return this.ifStatement();
    if (this.match(TokenType.While)) return this.whileStatement();
    if (this.match(TokenType.For)) return this.forStatement();
    if (this.match(TokenType.Return)) return this.returnStatement();
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
      if (this.isType(this.peek().type)) {
        init = this.declaration();
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

  private returnStatement(): AST.ReturnStatement {
    let value: AST.Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      value = this.expression();
    }
    this.consume(TokenType.Semicolon, "Expected ';' after return value.");
    return { type: "ReturnStatement", argument: value };
  }

  private blockStatement(): AST.BlockStatement {
    this.consume(TokenType.OpenBrace, "Expected '{' before block.");
    const statements: AST.Statement[] = [];
    while (!this.check(TokenType.CloseBrace) && !this.isAtEnd()) {
      statements.push(this.declaration());
    }
    this.consume(TokenType.CloseBrace, "Expected '}' after block.");
    return { type: "BlockStatement", body: statements };
  }

  private expressionStatement(): AST.ExpressionStatement {
    const expr = this.expression();
    this.consume(TokenType.Semicolon, "Expected ';' after expression.");
    return { type: "ExpressionStatement", expression: expr };
  }

  // ==== Expressions (Precedence) ====

  private expression(): AST.Expression {
    return this.assignment();
  }

  private assignment(): AST.Expression {
    const expr = this.logicalOr();

    if (this.match(TokenType.Equals)) {
      const equals = this.previous();
      const value = this.assignment();
      
      if (expr.type === "Identifier" || expr.type === "UnaryExpression") { // Allow unary for pointer deref assignment
        return {
          type: "AssignmentExpression",
          left: expr,
          operator: "=",
          right: value
        };
      }
      throw new Error(`Invalid assignment target at line ${equals.line}`);
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
  private logicalAnd(): AST.Expression { return this.parseBinary(this.equality, TokenType.LogicalAnd); }
  private equality(): AST.Expression { return this.parseBinary(this.comparison, TokenType.DoubleEquals, TokenType.NotEquals); }
  private comparison(): AST.Expression { return this.parseBinary(this.term, TokenType.LessThan, TokenType.LessEqual, TokenType.GreaterThan, TokenType.GreaterEqual); }
  private term(): AST.Expression { return this.parseBinary(this.factor, TokenType.Minus, TokenType.Plus); }
  private factor(): AST.Expression { return this.parseBinary(this.unary, TokenType.Slash, TokenType.Star); }

  private unary(): AST.Expression {
    if (this.match(TokenType.Bang, TokenType.Minus, TokenType.Star, TokenType.Ampersand)) {
      const operator = this.previous().value;
      const right = this.unary();
      return { type: "UnaryExpression", operator, argument: right };
    }
    return this.call();
  }

  private call(): AST.Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.OpenParen)) {
        expr = this.finishCall(expr);
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
    if (this.match(TokenType.Number)) {
      return { type: "NumberLiteral", value: parseFloat(this.previous().value) };
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

    throw new Error(`Expected expression at line ${this.peek().line}, col ${this.peek().column}, got ${this.peek().type}`);
  }
}
