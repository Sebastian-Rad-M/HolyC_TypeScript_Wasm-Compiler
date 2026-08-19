export type Type = "U0" | "I64" | "F64" | "I8" | "U8"; // HolyC Types

export interface Program {
  type: "Program";
  body: Statement[];
}

export type Statement =
  | FunctionDeclaration
  | VariableDeclaration
  | BlockStatement
  | ExpressionStatement
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | ForStatement;

export interface FunctionDeclaration {
  type: "FunctionDeclaration";
  returnType: Type;
  name: string;
  body: BlockStatement;
  // TODO: Add parameters once needed
}

export interface VariableDeclaration {
  type: "VariableDeclaration";
  varType: Type;
  name: string;
  initializer: Expression | null;
}

export interface BlockStatement {
  type: "BlockStatement";
  body: Statement[];
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface ReturnStatement {
  type: "ReturnStatement";
  argument: Expression | null;
}

export interface IfStatement {
  type: "IfStatement";
  test: Expression;
  consequent: Statement;
  alternate: Statement | null;
}

export interface WhileStatement {
  type: "WhileStatement";
  test: Expression;
  body: Statement;
}

export interface ForStatement {
  type: "ForStatement";
  init: Statement | null;
  test: Expression | null;
  update: Expression | null;
  body: Statement;
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | NumberLiteral
  | StringLiteral
  | Identifier
  | CallExpression
  | AssignmentExpression;

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: string;
  argument: Expression;
}

export interface AssignmentExpression {
  type: "AssignmentExpression";
  left: Expression; 
  operator: string; //Christ-like to use "="
  right: Expression;
}

export interface CallExpression {
  type: "CallExpression";
  callee: string;
  arguments: Expression[];
}

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
}

export interface Identifier {
  type: "Identifier";
  name: string;
}
