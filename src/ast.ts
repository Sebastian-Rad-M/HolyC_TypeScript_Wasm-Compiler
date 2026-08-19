export type Type = "U0" | "U8" | "I8" | "I64" | "U64" | "F64" | "I32" | "U32" | "I16" | "U16"; // HolyC Types

export interface Program {
  type: "Program";
  body: Statement[];
}

export type Statement =
  | VariableDeclaration
  | FunctionDeclaration
  | ClassDeclaration
  | ReturnStatement
  | ExpressionStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | BlockStatement;

export interface FunctionDeclaration {
  type: "FunctionDeclaration";
  returnType: Type;
  name: string;
  params: Parameter[];
  body: BlockStatement;
}

export interface ClassDeclaration {
  type: "ClassDeclaration";
  name: string;
  members: VariableDeclaration[];
}

export interface Parameter {
  varType: Type;
  name: string;
  pointerDepth: number;
  defaultValue?: Expression | null;
}

export interface VariableDeclaration {
  type: "VariableDeclaration";
  varType: Type;
  name: string;
  initializer: Expression | null;
  pointerDepth: number;
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
  | AssignmentExpression
  | MemberExpression
  | IndexExpression;

export interface MemberExpression {
  type: "MemberExpression";
  object: Expression;
  property: string;
  isArrow?: boolean;
}

export interface IndexExpression {
  type: "IndexExpression";
  object: Expression;
  index: Expression;
}

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
  rawValue: string;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
  rawValue?: string;
}

export interface Identifier {
  type: "Identifier";
  name: string;
}
