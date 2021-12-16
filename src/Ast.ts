import { Token } from "./Lexer";
import { SourceSpan } from "./SourceSpan";

export abstract class Node {
	public abstract sourceSpan: SourceSpan;
	public abstract visit(visitor: Visitor, context: any): any;
}

export class Element extends Node {
	constructor(
		public name: string,
		public attrs: Attribute[],
		public children: Node[],
		public sourceSpan: SourceSpan,
		public startSourceSpan: SourceSpan,
		public endSourceSpan: SourceSpan | null = null
	) {
		super();
	}
	public visit(visitor: Visitor, context: any) {
		return visitor.visitElement(this, context);
	}
}

export class Attribute extends Node {
	constructor(
		public name: string,
		public value: string | null,
		public sourceSpan: SourceSpan,
		public keySpan: SourceSpan | undefined,
		public valueSpan: SourceSpan | undefined,
		public valueTokens: Token[] | undefined
	) {
		super();
	}
	public visit(visitor: Visitor, context: any): any {
		return visitor.visitAttribute(this, context);
	}
}

export class Text extends Node {
	constructor(
		public value: string,
		public sourceSpan: SourceSpan,
		public tokens: Token[]
	) {
		super();
	}
	public visit(visitor: Visitor, context: any) {
		return visitor.visitText(this, context);
	}
}

export class Comment extends Node {
	constructor(public value: string | null, public sourceSpan: SourceSpan) {
		super();
	}
	public visit(visitor: Visitor, context: any) {
		return visitor.visitComment(this, context);
	}
}

export interface Visitor {
	visit?(node: Node, context: any): any;

	visitElement(element: Element, context: any): any;
	visitAttribute(attribute: Attribute, context: any): any;
	visitText(text: Text, context: any): any;
	visitComment(comment: Comment, context: any): any;
}

export function visitAll(
	visitor: Visitor,
	nodes: Array<Node>,
	context: any
): Array<any> {
	const result: Array<any> = [];

	const visit = visitor.visit
		? (ast: Node) =>
				visitor.visit!(ast, context) || ast.visit(visitor, context)
		: (ast: Node) => ast.visit(visitor, context);

	nodes.forEach((ast) => {
		const astRes = visit(ast);
		if (astRes) {
			result.push(astRes);
		}
	});

	return result;
}
