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

	export class TextAttribute extends BasicNode {
		constructor(sourceSpan: ParseSourceSpan) {
			super(sourceSpan);
		}

		public visit<T>(visitor: Visitor<T>): T {
			return visitor.visitTextAttribute(this);
		}
	}

	export interface Visitor<T = any> {
		// visit?(node: Node): T;
		// visitElement(element: Element): T;
		// visitTemplate(template: Template): T;
		// visitContent(content: Content): T;
		// visitVariable(variable: Variable): T;
		// visitReference(reference: Reference): T;
		visitTextAttribute(attribute: TextAttribute): T;
		// visitBoundAttribute(attribute: BoundAttribute): T;
		// visitBoundEvent(attribute: BoundEvent): T;
		// visitText(text: Text): T;
		// visitBoundText(text: BoundText): T;
		// visitIcu(icu: Icu): T;
	}
}
