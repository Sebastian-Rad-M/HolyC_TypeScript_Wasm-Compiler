export enum TokenType {
  // Types
  U0 = "U0",
  U8 = "U8",
  I8 = "I8",
  I64 = "I64",
  F64 = "F64",

  // Keywords
  Return = "return",
  If = "if",
  Else = "else",
  While = "while",
  For = "for",

  // Directives
  Directive = "Directive", // e.g. #exe

  // Literals & Identifiers
  Identifier = "Identifier",
  Number = "Number",
  String = "String",

  // Punctuation & Operators
  OpenParen = "(",
  CloseParen = ")",
  OpenBrace = "{",
  CloseBrace = "}",
  OpenBracket = "[",
  CloseBracket = "]",
  Semicolon = ";",
  Comma = ",",
  Plus = "+",
  Minus = "-",
  Star = "*",
  Slash = "/",
  Equals = "=",
  DoubleEquals = "==",
  NotEquals = "!=",
  LessThan = "<",
  GreaterThan = ">",
  LessEqual = "<=",
  GreaterEqual = ">=",
  Ampersand = "&",
  LogicalAnd = "&&",
  LogicalOr = "||",
  Bang = "!",

  // End of file
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  private advance(): string {
    const char = this.source[this.position] || '\0';
    this.position++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position] || '\0';
  }

  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1] || '\0';
  }

  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  private skipWhitespaceAndComments() {
    while (!this.isAtEnd()) {
      const c = this.peek();
      if (c === ' ' || c === '\r' || c === '\t' || c === '\n') {
        this.advance();
      } else if (c === '/' && this.peekNext() === '/') {
        // Single-line comment
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }
      } else if (c === '/' && this.peekNext() === '*') {
        // Multi-line comment
        this.advance(); // /
        this.advance(); // *
        while (!this.isAtEnd()) {
          if (this.peek() === '*' && this.peekNext() === '/') {
            this.advance(); // *
            this.advance(); // /
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;

      const startLine = this.line;
      const startCol = this.column;
      const c = this.advance();

      const singleCharTokens: Record<string, TokenType> = {
        '(': TokenType.OpenParen, ')': TokenType.CloseParen, '{': TokenType.OpenBrace, '}': TokenType.CloseBrace,
        '[': TokenType.OpenBracket, ']': TokenType.CloseBracket, ';': TokenType.Semicolon, ',': TokenType.Comma,
        '+': TokenType.Plus, '-': TokenType.Minus, '*': TokenType.Star, '/': TokenType.Slash
      };

      if (singleCharTokens[c]) {
        tokens.push({ type: singleCharTokens[c], value: c, line: startLine, column: startCol });
        continue;
      }

      const matchNext = (expected: string, typeIfMatch: TokenType, typeIfNot: TokenType) => {
        if (this.peek() === expected) {
          this.advance();
          tokens.push({ type: typeIfMatch, value: c + expected, line: startLine, column: startCol });
        } else {
          tokens.push({ type: typeIfNot, value: c, line: startLine, column: startCol });
        }
      };

      if (c === '=') { matchNext('=', TokenType.DoubleEquals, TokenType.Equals); continue; }
      if (c === '!') { matchNext('=', TokenType.NotEquals, TokenType.Bang); continue; }
      if (c === '<') { matchNext('=', TokenType.LessEqual, TokenType.LessThan); continue; }
      if (c === '>') { matchNext('=', TokenType.GreaterEqual, TokenType.GreaterThan); continue; }
      if (c === '&') { matchNext('&', TokenType.LogicalAnd, TokenType.Ampersand); continue; }
      if (c === '|') {
        if (this.peek() === '|') {
          this.advance();
          tokens.push({ type: TokenType.LogicalOr, value: "||", line: startLine, column: startCol });
          continue;
        }
      }

      // Directives
      if (c === '#') {
        let directiveValue = c;
        while (this.isAlphaNumeric(this.peek())) directiveValue += this.advance();
        tokens.push({ type: TokenType.Directive, value: directiveValue, line: startLine, column: startCol });
        continue;
      }

      // Strings
      if (c === '"') {
        let stringValue = "";
        while (this.peek() !== '"' && !this.isAtEnd()) {
          if (this.peek() === '\\') {
            this.advance();
            if (!this.isAtEnd()) {
              const esc = this.advance();
              stringValue += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
            }
          } else {
            stringValue += this.advance();
          }
        }
        if (!this.isAtEnd()) this.advance();
        tokens.push({ type: TokenType.String, value: stringValue, line: startLine, column: startCol });
        continue;
      }

      // Character literals
      if (c === "'") {
        let charValue = "";
        if (this.peek() === '\\') {
          this.advance();
          const esc = this.advance();
          charValue = esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
        } else {
          charValue = this.advance();
        }
        if (this.peek() === "'") this.advance();
        tokens.push({ type: TokenType.Number, value: charValue.charCodeAt(0).toString(), line: startLine, column: startCol });
        continue;
      }

      // Numbers
      if (this.isDigit(c) || (c === '.' && this.isDigit(this.peek()))) {
        let numValue = c;
        let hasDot = c === '.';
        while (this.isDigit(this.peek()) || (!hasDot && this.peek() === '.')) {
          if (this.peek() === '.') hasDot = true;
          numValue += this.advance();
        }
        tokens.push({ type: TokenType.Number, value: numValue, line: startLine, column: startCol });
        continue;
      }

      // Identifiers and Keywords
      if (this.isAlpha(c)) {
        let idValue = c;
        while (this.isAlphaNumeric(this.peek())) idValue += this.advance();

        const keywords: Record<string, TokenType> = {
          U0: TokenType.U0, U8: TokenType.U8, I8: TokenType.I8, I64: TokenType.I64, F64: TokenType.F64,
          return: TokenType.Return, if: TokenType.If, else: TokenType.Else, while: TokenType.While, for: TokenType.For
        };

        tokens.push({ type: keywords[idValue] || TokenType.Identifier, value: idValue, line: startLine, column: startCol });
        continue;
      }

      throw new Error(`Unexpected character '${c}' at line ${startLine}, column ${startCol}`);
    }

    tokens.push({ type: TokenType.EOF, value: "EOF", line: this.line, column: this.column });
    return tokens;
  }
}
