import { ParseSourceSpan } from "./ParseSourceFile";
import { Lexer } from "./Lexer";
export namespace AST {
	export interface Visitor {
		visit?(node: Node, context: any): any;
		visitElement(element: Element, context: any): any;
		visitAttribute(attribute: Attribute, context: any): any;
		visitText(text: Text, context: any): any;
		visitComment(comment: Comment, context: any): any;
	}

	export interface BasicNode {
		sourceSpan: ParseSourceSpan;
		visit(visitor: Visitor, context: any): any;
	}

	export abstract class Node implements BasicNode {
		constructor(public sourceSpan: ParseSourceSpan) {}
		public abstract visit(visitor: Visitor, content: any): any;
	}

	export type TokenNode = Element | Attribute | Text | Comment;

	export class Element extends Node {
		constructor(
			public readonly name: string,
			public attributes: Attribute[],
			public children: Node[],
			sourceSpan: ParseSourceSpan,
			public startSourceSpan: ParseSourceSpan,
			public endSourceSpan: ParseSourceSpan | null = null,
		) {
			super(sourceSpan);
		}

		public visit(visitor: Visitor, context: any) {
			visitor.visitElement(this, context);
		}
	}

	export class Attribute extends Node {
		constructor(
			public name: string,
			public value: string,
			public valueTokens: Lexer.Token[] | undefined,
			sourceSpan: ParseSourceSpan,
			public readonly keySourceSpan: ParseSourceSpan | undefined,
			public valueSourceSpan: ParseSourceSpan | undefined,
		) {
			super(sourceSpan);
		}
		public visit(visitor: Visitor, context: any) {
			visitor.visitAttribute(this, context);
		}
	}

	export class Text extends Node {
		constructor(
			public value: string,
			public tokens: Lexer.Token[],
			sourceSpan: ParseSourceSpan,
		) {
			super(sourceSpan);
		}
		public visit(visitor: Visitor, context: any) {
			visitor.visitText(this, context);
		}
	}

	export class Comment extends Node {
		constructor(public readonly value: string | null, sourceSpan: ParseSourceSpan) {
			super(sourceSpan);
		}
		public visit(visitor: Visitor, context: any) {
			visitor.visitComment(this, context);
		}
	}
}
