import { ParseSourceSpan } from "src/html-compiler/ParseSourceFile";

export namespace ExpressionAST {
	export class ParserError {
		constructor(
			public message: string,
			public input: string,
			public errLocation: string,
			public ctxLocation?: any,
		) {
			this.message = `Parse Error: ${this.message} ${errLocation} [${input} in ${ctxLocation}]`;
		}
	}

	export class AbsoluteSourceSpan {
		constructor(public readonly start: number, public readonly end: number) {}
	}

	export class ParseSpan {
		constructor(public readonly start: number, public readonly end: number) {}
	}

	export abstract class Node {
		public abstract span: ParseSpan;
		public abstract sourceSpan: AbsoluteSourceSpan;
		public abstract visit(visitor: Visitor, context: any): any;
	}

	export abstract class NodeWithName extends Node {}

	export class PropertyRead extends NodeWithName {
		constructor(
			public key: string,
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public nameSourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitPropertyRead(this, context);
		}
	}

	export class PropertyWrite extends NodeWithName {
		constructor(
			public key: string,
			public value: Node,
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public nameSourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitPropertyWrite(this, context);
		}
	}

	export class SafePropertyRead extends NodeWithName {
		constructor(
			public key: string,
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public nameSourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitSafePropertyRead(this, context);
		}
	}

	export class KeyRead extends Node {
		constructor(
			public key: Node,
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public nameSourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {
			return visitor.visitKeyRead(this, context);
		}
	}

	export class KeyWrite extends Node {
		constructor(
			public key: Node,
			public value: Node,
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public nameSourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {
			return visitor.visitKeyWrite(this, context);
		}
	}

	export class SafeKeyRead extends Node {
		constructor(
			public key: Node,
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public nameSourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {
			return visitor.visitSafeKeyRead(this, context);
		}
	}

	export class EmptyExpression extends Node {
		constructor(public span: ParseSpan, public sourceSpan: AbsoluteSourceSpan) {
			super();
		}
		public visit() {
			return null;
		}
	}

	export class LiteralPrimitive extends Node {
		constructor(
			public value: any,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitLiteralPrimitive(this, context);
		}
	}

	export class LiteralArray extends Node {
		constructor(
			public expressions: Node[],
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitLiteralArray(this, context);
		}
	}

	export interface LiteralMapKey {
		key: string;
		isQuote: boolean;
	}

	export class LiteralMap extends Node {
		constructor(
			public keys: LiteralMapKey[],
			public values: Node[],
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {
			return visitor.visitLiteralMap(this, context);
		}
	}

	export class Call extends Node {
		// TODO
		constructor(
			public args: Node[],
			public thisReceiver: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
			public argsSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {
			return visitor.visitCall(this, context);
		}
	}

	export class ImplicitReceiver extends Node {
		constructor(public span: ParseSpan, public sourceSpan: AbsoluteSourceSpan) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitImplicitReceiver(this, context);
		}
	}

	export class Binary extends Node {
		constructor(
			public left: Node,
			public operator: string,
			public right: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {
			return visitor.visitBinary(this, context);
		}
	}
	export class Unary extends Binary {
		// + x == x - 0
		public static createPlus(
			expression: Node,
			span: ParseSpan,
			sourceSpan: AbsoluteSourceSpan,
		) {
			return new Unary(
				"+",
				expression,
				expression,
				"-",
				new LiteralPrimitive(0, span, sourceSpan),
				span,
				sourceSpan,
			);
		}
		// 0-x == -x
		public static createMinus(
			expression: Node,
			span: ParseSpan,
			sourceSpan: AbsoluteSourceSpan,
		) {
			return new Unary(
				"-",
				expression,
				new LiteralPrimitive(0, span, sourceSpan),
				"-",
				expression,
				span,
				sourceSpan,
			);
		}

		private constructor(
			public unaryOperator: string,
			public expression: Node,
			binaryLeft: Node,
			binaryOp: string,
			binaryRight: Node,
			span: ParseSpan,
			sourceSpan: AbsoluteSourceSpan,
		) {
			super(binaryLeft, binaryOp, binaryRight, span, sourceSpan);
		}

		public visit(visitor: Visitor, context: any) {
			return visitor?.visitUnary(this, context) ?? super.visit(visitor, context);
		}
	}

	export class Conditional extends Node {
		constructor(
			public condition: Node,
			public yes: Node,
			public no: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitConditional(this, context);
		}
	}

	export class PrefixNot extends Node {
		constructor(
			public expression: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitPrefixNot(this, context);
		}
	}

	export class Interpolation extends Node {
		constructor(
			public strings: string[],
			public expressions: Node[],
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}
		public visit(visitor: Visitor, context: any) {
			return visitor.visitInterpolation(this, context);
		}
	}

	export interface Visitor {
		visitPrefixNot(ast: PrefixNot, context: any): any;
		visitUnary(ast: Unary, context: any): any;
		visitConditional(ast: Conditional, context: any): any;
		visitBinary(ast: Binary, context: any): any;
		visitSafeKeyRead(ast: SafeKeyRead, context: any): any;
		visitKeyWrite(ast: KeyWrite, context: any): any;
		visitKeyRead(ast: KeyRead, context: any): any;
		visitSafePropertyRead(ast: SafePropertyRead, context: any): any;
		visitPropertyWrite(ast: PropertyWrite, context: any): any;
		visitPropertyRead(ast: PropertyRead, context: any): any;
		visitCall(ast: Call, context: any): any;
		visitLiteralMap(ast: LiteralMap, context: any): any;
		visitLiteralArray(ast: LiteralArray, context: any): any;
		visitImplicitReceiver(ast: ImplicitReceiver, context: any): any;
		visitLiteralPrimitive(ast: LiteralPrimitive, context: any): any;
		visitInterpolation(ast: Interpolation, context: any): any;
	}

	export class ASTWithSource extends Node {
		constructor(
			public ast: Node,
			public span: ParseSpan,
			public sourceSpan: AbsoluteSourceSpan,
		) {
			super();
		}

		public visit(visitor: Visitor, context: any) {}
	}

	export type TemplateBinding = VariableBinding | ExpressionBinding;

	export class VariableBinding {
		constructor(
			public readonly key: TemplateBindingIdentifier,
			public readonly value: TemplateBindingIdentifier | null,
			public readonly sourceSpan: AbsoluteSourceSpan,
		) {}
	}

	export class ExpressionBinding {
		constructor(
			public readonly key: TemplateBindingIdentifier,
			public readonly value: ASTWithSource | null,
			public readonly sourceSpan: AbsoluteSourceSpan,
		) {}
	}

	export interface TemplateBindingIdentifier {
		source: string;
		span?: AbsoluteSourceSpan;
	}

	export enum ParsedPropertyType {
		DEFAULT,
		LITERAL_ATTR,
	}

	export enum ParsedEventType {
		Regular,
	}

	export const enum BindingType {
		// A regular binding to a property (e.g. `[property]="expression"`).
		Property,
		// A binding to an element attribute (e.g. `[attr.name]="expression"`).
		Attribute,
		// A binding to a CSS class (e.g. `[class.name]="condition"`).
		Class,
		// A binding to a style rule (e.g. `[style.rule]="expression"`).
		Style,
		// A binding to an animation reference (e.g. `[animate.key]="expression"`).
		Animation,
	}

	export class ParsedProperty {
		public isLiteral: boolean;

		constructor(
			public name: string,
			public expression: ASTWithSource,
			public type: ParsedPropertyType,
			public sourceSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan | undefined,
			public valueSpan: ParseSourceSpan | undefined,
		) {
			this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
		}
	}

	export class ParsedVariable {
		constructor(
			public name: string,
			public value: string,
			public sourceSpan: ParseSourceSpan,
			readonly keySpan: ParseSourceSpan,
			public valueSpan?: ParseSourceSpan,
		) {}
	}
}
