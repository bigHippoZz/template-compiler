import { ExpressionAST } from "../expression-compiler/AST";

import { ParseSourceSpan } from "src/html-compiler/ParseSourceFile";

export namespace RenderAST {
	export interface Node {
		sourceSpan: ParseSourceSpan;
		visit<T>(visitor: Visitor<T>): T;
	}

	export abstract class BasicNode implements Node {
		constructor(public sourceSpan: ParseSourceSpan) {}
		public abstract visit<T>(visitor: Visitor<T>): T;
	}

	export class Variable extends BasicNode {
		constructor(
			public name: string,
			public value: string,
			public sourceSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan,
			public valueSpan?: ParseSourceSpan,
		) {
			super(sourceSpan);
		}
		visit<T>(visitor: Visitor<T>): T {
			return visitor.visitVariable(this);
		}
	}

	export class Text extends BasicNode {
		constructor(public value: string, public sourceSpan: ParseSourceSpan) {
			super(sourceSpan);
		}
		visit<T>(visitor: Visitor<T>): T {
			return visitor.visitText(this);
		}
	}

	export class BoundText extends BasicNode {
		constructor(public value: ExpressionAST.Node, public sourceSpan: ParseSourceSpan) {
			super(sourceSpan);
		}
		visit<T>(visitor: Visitor<T>): T {
			return visitor.visitBoundText(this);
		}
	}

	export class TextAttribute extends BasicNode {
		constructor(
			public name: string,
			public value: string,
			sourceSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan | undefined,
			public valueSpan?: ParseSourceSpan,
		) {
			super(sourceSpan);
		}

		public visit<T>(visitor: Visitor<T>): T {
			return visitor.visitTextAttribute(this);
		}
	}

	export class BoundAttribute extends BasicNode {
		constructor(
			public name: string,
			public type: ExpressionAST.BindingType,
			public value: ExpressionAST.Node,
			public unit: string | null,
			public sourceSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan,
			public valueSpan: ParseSourceSpan | undefined,
		) {
			super(sourceSpan);
		}

		public visit<T>(visitor: Visitor<T>): T {
			return visitor.visitBoundAttribute(this);
		}
	}

	export class Reference extends BasicNode {
		constructor(
			public name: string,
			public value: string,
			public sourceSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan,
			public valueSpan?: ParseSourceSpan,
		) {
			super(sourceSpan);
		}
		visit<Result>(visitor: Visitor<Result>): Result {
			return visitor.visitReference(this);
		}
	}

	export class BoundEvent extends BasicNode {
		constructor(
			public name: string,
			public type: ExpressionAST.ParsedEventType,
			public handler: ExpressionAST.Node,
			public target: string | null,
			public phase: string | null,
			public sourceSpan: ParseSourceSpan,
			public handlerSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan,
		) {
			super(sourceSpan);
		}

		public static fromParsedEvent(event: ExpressionAST.ParsedEvent) {
			return new BoundEvent(
				event.name,
				event.type,
				event.handler,
				null,
				null,
				event.sourceSpan,
				event.handlerSpan,
				null as any,
			);
		}

		public visit<T>(visitor: Visitor<T>): T {
			return visitor.visitBoundEvent(this);
		}
	}

	export class Element extends BasicNode {
		constructor(
			public name: string,
			public attributes: TextAttribute[],
			public inputs: BoundAttribute[],
			public outputs: BoundEvent[],
			public children: Node[],
			public references: Reference[],
			public sourceSpan: ParseSourceSpan,
			public startSourceSpan: ParseSourceSpan,
			public endSourceSpan: ParseSourceSpan | null,
		) {
			super(sourceSpan);
		}
		visit<Result>(visitor: Visitor<Result>): Result {
			return visitor.visitElement(this);
		}
	}

	export class Template extends BasicNode {
		constructor(
			public tagName: string,
			public attributes: TextAttribute[],
			public inputs: BoundAttribute[],
			public outputs: BoundEvent[],
			public templateAttrs: (BoundAttribute | TextAttribute)[],
			public children: Node[],
			public references: Reference[],
			public variables: Variable[],
			public sourceSpan: ParseSourceSpan,
			public startSourceSpan: ParseSourceSpan,
			public endSourceSpan: ParseSourceSpan | null,
		) {
			super(sourceSpan);
		}
		visit<Result>(visitor: Visitor<Result>): Result {
			return visitor.visitTemplate(this);
		}
	}

	export interface Visitor<T = any> {
		// visit?(node: Node): T;
		visitElement(element: Element): T;
		visitTemplate(template: Template): T;
		// visitContent(content: Content): T;
		visitVariable(variable: Variable): T;
		visitReference(reference: Reference): T;
		visitTextAttribute(attribute: TextAttribute): T;
		visitBoundAttribute(attribute: BoundAttribute): T;
		visitBoundEvent(attribute: BoundEvent): T;
		visitText(text: Text): T;
		visitBoundText(text: BoundText): T;
		// visitIcu(icu: Icu): T;
	}
}
