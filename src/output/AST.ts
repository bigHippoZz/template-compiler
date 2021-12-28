// import { ParseSourceSpan } from "src/html-compiler/ParseSourceFile";

// export abstract class Expression {
// 	public type: Type | null;
// 	public sourceSpan: ParseSourceSpan | null;

// 	constructor(type: Type | null | undefined, sourceSpan?: ParseSourceSpan | null) {
// 		this.type = type || null;
// 		this.sourceSpan = sourceSpan || null;
// 	}

// 	abstract visitExpression(visitor: ExpressionVisitor, context: any): any;
// 	abstract isEquivalent(e: Expression): boolean;
// 	abstract isConstant(): boolean;

// 	prop(name: string, sourceSpan?: ParseSourceSpan | null): ReadPropExpr {
// 		return new ReadPropExpr(this, name, null, sourceSpan);
// 	}

// 	key(index: Expression, type?: Type | null, sourceSpan?: ParseSourceSpan | null): ReadKeyExpr {
// 		return new ReadKeyExpr(this, index, type, sourceSpan);
// 	}

// 	callFn(
// 		params: Expression[],
// 		sourceSpan?: ParseSourceSpan | null,
// 		pure?: boolean,
// 	): InvokeFunctionExpr {
// 		return new InvokeFunctionExpr(this, params, null, sourceSpan, pure);
// 	}

// 	instantiate(
// 		params: Expression[],
// 		type?: Type | null,
// 		sourceSpan?: ParseSourceSpan | null,
// 	): InstantiateExpr {
// 		return new InstantiateExpr(this, params, type, sourceSpan);
// 	}

// 	conditional(
// 		trueCase: Expression,
// 		falseCase: Expression | null = null,
// 		sourceSpan?: ParseSourceSpan | null,
// 	): ConditionalExpr {
// 		return new ConditionalExpr(this, trueCase, falseCase, null, sourceSpan);
// 	}

// 	equals(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Equals, this, rhs, null, sourceSpan);
// 	}
// 	notEquals(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.NotEquals, this, rhs, null, sourceSpan);
// 	}
// 	identical(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Identical, this, rhs, null, sourceSpan);
// 	}
// 	notIdentical(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.NotIdentical, this, rhs, null, sourceSpan);
// 	}
// 	minus(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Minus, this, rhs, null, sourceSpan);
// 	}
// 	plus(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Plus, this, rhs, null, sourceSpan);
// 	}
// 	divide(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Divide, this, rhs, null, sourceSpan);
// 	}
// 	multiply(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Multiply, this, rhs, null, sourceSpan);
// 	}
// 	modulo(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Modulo, this, rhs, null, sourceSpan);
// 	}
// 	and(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.And, this, rhs, null, sourceSpan);
// 	}
// 	bitwiseAnd(
// 		rhs: Expression,
// 		sourceSpan?: ParseSourceSpan | null,
// 		parens: boolean = true,
// 	): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(
// 			BinaryOperator.BitwiseAnd,
// 			this,
// 			rhs,
// 			null,
// 			sourceSpan,
// 			parens,
// 		);
// 	}
// 	or(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Or, this, rhs, null, sourceSpan);
// 	}
// 	lower(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Lower, this, rhs, null, sourceSpan);
// 	}
// 	lowerEquals(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.LowerEquals, this, rhs, null, sourceSpan);
// 	}
// 	bigger(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.Bigger, this, rhs, null, sourceSpan);
// 	}
// 	biggerEquals(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.BiggerEquals, this, rhs, null, sourceSpan);
// 	}
// 	isBlank(sourceSpan?: ParseSourceSpan | null): Expression {
// 		// Note: We use equals by purpose here to compare to null and undefined in JS.
// 		// We use the typed null to allow strictNullChecks to narrow types.
// 		return this.equals(TYPED_NULL_EXPR, sourceSpan);
// 	}
// 	cast(type: Type, sourceSpan?: ParseSourceSpan | null): Expression {
// 		return new CastExpr(this, type, sourceSpan);
// 	}
// 	nullishCoalesce(rhs: Expression, sourceSpan?: ParseSourceSpan | null): BinaryOperatorExpr {
// 		return new BinaryOperatorExpr(BinaryOperator.NullishCoalesce, this, rhs, null, sourceSpan);
// 	}

// 	toStmt(): Statement {
// 		return new ExpressionStatement(this, null);
// 	}
// }

// export interface ExpressionVisitor {
// 	visitReadVarExpr(ast: ReadVarExpr, context: any): any;
// 	visitWriteVarExpr(expr: WriteVarExpr, context: any): any;
// 	visitWriteKeyExpr(expr: WriteKeyExpr, context: any): any;
// 	visitWritePropExpr(expr: WritePropExpr, context: any): any;
// 	visitInvokeFunctionExpr(ast: InvokeFunctionExpr, context: any): any;
// 	visitTaggedTemplateExpr(ast: TaggedTemplateExpr, context: any): any;
// 	visitInstantiateExpr(ast: InstantiateExpr, context: any): any;
// 	visitLiteralExpr(ast: LiteralExpr, context: any): any;
// 	visitLocalizedString(ast: LocalizedString, context: any): any;
// 	visitExternalExpr(ast: ExternalExpr, context: any): any;
// 	visitConditionalExpr(ast: ConditionalExpr, context: any): any;
// 	visitNotExpr(ast: NotExpr, context: any): any;
// 	visitAssertNotNullExpr(ast: AssertNotNull, context: any): any;
// 	visitCastExpr(ast: CastExpr, context: any): any;
// 	visitFunctionExpr(ast: FunctionExpr, context: any): any;
// 	visitUnaryOperatorExpr(ast: UnaryOperatorExpr, context: any): any;
// 	visitBinaryOperatorExpr(ast: BinaryOperatorExpr, context: any): any;
// 	visitReadPropExpr(ast: ReadPropExpr, context: any): any;
// 	visitReadKeyExpr(ast: ReadKeyExpr, context: any): any;
// 	visitLiteralArrayExpr(ast: LiteralArrayExpr, context: any): any;
// 	visitLiteralMapExpr(ast: LiteralMapExpr, context: any): any;
// 	visitCommaExpr(ast: CommaExpr, context: any): any;
// 	visitWrappedNodeExpr(ast: WrappedNodeExpr<any>, context: any): any;
// 	visitTypeofExpr(ast: TypeofExpr, context: any): any;
// }

// export interface TypeVisitor {
// 	visitBuiltinType(type: BuiltinType, context: any): any;
// 	visitExpressionType(type: ExpressionType, context: any): any;
// 	visitArrayType(type: ArrayType, context: any): any;
// 	visitMapType(type: MapType, context: any): any;
// }

// //// Types
// export enum TypeModifier {
// 	Const,
// }

// export abstract class Type {
// 	constructor(public modifiers: TypeModifier[] = []) {}
// 	abstract visitType(visitor: TypeVisitor, context: any): any;

// 	hasModifier(modifier: TypeModifier): boolean {
// 		return this.modifiers.indexOf(modifier) !== -1;
// 	}
// }
// /**
//  * 读取prop
//  */
// export class ReadPropExpr extends Expression {
// 	constructor(
// 		public receiver: Expression,
// 		public name: string,
// 		type: Type | null,
// 		sourceSpan?: ParseSourceSpan | null,
// 	) {
// 		super(type, sourceSpan);
// 	}
// 	override isEquivalent(e: Expression): boolean {
// 		return (
// 			e instanceof ReadPropExpr &&
// 			this.receiver.isEquivalent(e.receiver) &&
// 			this.name === e.name
// 		);
// 	}

// 	override isConstant() {
// 		return false;
// 	}

// 	override visitExpression(visitor: ExpressionVisitor, context: any): any {
// 		return visitor.visitReadPropExpr(this, context);
// 	}

// 	set(value: Expression): WritePropExpr {
// 		return new WritePropExpr(this.receiver, this.name, value, null, this.sourceSpan);
// 	}
// }

// /**
//  * 赋值prop
//  */
// export class WritePropExpr extends Expression {
// 	public value: Expression;
// 	constructor(
// 		public receiver: Expression,
// 		public name: string,
// 		value: Expression,
// 		type?: Type | null,
// 		sourceSpan?: ParseSourceSpan | null,
// 	) {
// 		super(type || value.type, sourceSpan);
// 		this.value = value;
// 	}

// 	override isEquivalent(e: Expression): boolean {
// 		return (
// 			e instanceof WritePropExpr &&
// 			this.receiver.isEquivalent(e.receiver) &&
// 			this.name === e.name &&
// 			this.value.isEquivalent(e.value)
// 		);
// 	}

// 	override isConstant() {
// 		return false;
// 	}

// 	override visitExpression(visitor: ExpressionVisitor, context: any): any {
// 		return visitor.visitWritePropExpr(this, context);
// 	}
// }
// /**
//  * 文字表达式
//  */
// export class LiteralExpr extends Expression {
// 	constructor(
// 		public value: number | string | boolean | null | undefined,
// 		type?: Type | null,
// 		sourceSpan?: ParseSourceSpan | null,
// 	) {
// 		super(type, sourceSpan);
// 	}

// 	override isEquivalent(e: Expression): boolean {
// 		return e instanceof LiteralExpr && this.value === e.value;
// 	}

// 	override isConstant() {
// 		return true;
// 	}

// 	override visitExpression(visitor: ExpressionVisitor, context: any): any {
// 		return visitor.visitLiteralExpr(this, context);
// 	}
// }

// export function literal(
// 	value: any,
// 	type?: Type | null,
// 	sourceSpan?: ParseSourceSpan | null,
// ): LiteralExpr {
// 	return new LiteralExpr(value, type, sourceSpan);
// }

// export interface VisitorDesign {
// 	visit(...args: any[]): any;
// }

// export abstract class Statement {}

// export abstract class DeclarationStatement extends Statement {}

// export class DeclarationVarStatement extends DeclarationStatement implements VisitorDesign {
// 	constructor(public name: string, public value: ExpressionStatement) {
// 		super();
// 	}
// }

// export class DeclarationFunctionStatement extends DeclarationStatement implements VisitorDesign {
// 	constructor(
// 		name: string | null ,
// 		args: ExpressionStatement[],

// 	) {
// 		super();
// 	}
// }

// export class ReturnStatement extends Statement implements VisitorDesign {
// 	constructor() {
// 		super();
// 	}
// }

// export class ExpressionStatement extends Statement implements VisitorDesign {
// 	constructor() {
// 		super();
// 	}
// }

// export class IfStatement extends Statement implements VisitorDesign {
// 	constructor() {
// 		super();
// 	}
// }

// export class TryCatcherStatement extends Statement implements VisitorDesign {
// 	constructor() {
// 		super();
// 	}
// }

// export class ThrowStatement extends Statement implements VisitorDesign {
// 	constructor() {
// 		super();
// 	}
// }
