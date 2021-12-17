export interface AstVisitor {}

export class AbsoluteSourceSpan {
	constructor(public readonly start: number, public readonly end: number) {}
}

export class ParseSpan {
	constructor(public readonly start: number, public readonly end: number) {}
	public toAbsolute(offset: number) {
		return new AbsoluteSourceSpan(this.start + offset, this.end + offset);
	}
}

export abstract class AST {
	public abstract span: ParseSpan;
	public abstract sourceSpan: AbsoluteSourceSpan;
	public abstract visit(): any;
}

export abstract class ASTWithName extends AST {
	public abstract nameSpan: AbsoluteSourceSpan;
}

export class Binary extends AST {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public operator: string,
		public left: AST,
		public right: AST,
	) {
		super();
	}
	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class Chain extends AST {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public expressions: any[],
	) {
		super();
	}
	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class PropertyRead extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public name: string,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class PropertyWrite extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public name: string,
		public value: AST,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class SafePropertyWrite extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public name: string,
		public value: AST,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class SafePropertyRead extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public name: string,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class KeyRead extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public key: AST,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}
export class SafeKeyRead extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public key: AST,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class KeyWrite extends ASTWithName {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public nameSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public key: AST,
		public value: AST,
	) {
		super();
	}

	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class LiteralPrimitive extends AST {
	constructor(public span: ParseSpan, public sourceSpan: AbsoluteSourceSpan, public value: any) {
		super();
	}
	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class LiteralArray extends AST {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public expressions: any,
	) {
		super();
	}
	public visit() {
		throw new Error("Method not implemented.");
	}
}

export class Call extends AST {
	constructor(
		public span: ParseSpan,
		public sourceSpan: AbsoluteSourceSpan,
		public argumentsSpan: AbsoluteSourceSpan,
		public receiver: AST,
		public args: any,
	) {
		super();
	}
	public visit() {
		throw new Error("Method not implemented.");
	}
}
