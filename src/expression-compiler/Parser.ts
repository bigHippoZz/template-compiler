import { ExpressionLexer } from "./Lexer";
import { CharCodes, isQuote } from "../html-compiler/CharCodes";
import { ExpressionAST } from "./AST";
import {
	DEFAULT_INTERPOLATION_CONFIG,
	InterpolationConfig,
} from "src/html-compiler/InterpolationConfig";

export namespace ExpressionParser {
	export const EOF = new ExpressionLexer.SyntaxToken(
		-1,
		-1,
		ExpressionLexer.SyntaxTokenKind.Error,
		0,
		"",
	);

	export interface InterpolationPiece {
		text: string;
		start: number;
		end: number;
	}

	export class SplitInterpolation {
		constructor(
			public strings: InterpolationPiece[],
			public expressions: InterpolationPiece[],
			public offsets: number[],
		) {}
	}

	export class Parser {
		constructor(private _lexer: ExpressionLexer.Lexer) {}
		public parseTemplateBindings(
			templateKey: string,
			templateValue: string,
			absoluteKeyOffset: number,
			absoluteValueOffset: number,
		): TemplateBindingParseResult {
			const tokens = this._lexer.tokenize(templateValue);
			const parser = new _ParseAST(templateValue, tokens);
			return parser.parseTemplateBindings({ source: templateKey });
		}

		public parseInterpolation(
			input: string,
			location: string,
			absoluteOffset: number,
			interpolationConfig: InterpolationConfig = DEFAULT_INTERPOLATION_CONFIG,
		) {
			const { strings, expressions, offsets } = this._splitInterpolation(
				input,
				location,
				interpolationConfig,
			);

			if (!expressions.length) return null;

			const expressionNodes: ExpressionAST.Node[] = [];

			for (let i = 0; i < expressions.length; i++) {
				const expressionStr = expressions[i].text;
				const tokens = this._lexer.tokenize(expressionStr);
				expressionNodes.push(new _ParseAST(expressionStr, tokens).parseExpression());
			}

			return new ExpressionAST.ASTWithSource(
				new ExpressionAST.Interpolation(
					strings.map((str) => str.text),
					expressionNodes,
					null as any,
					null as any,
				),
				null as any,
				null as any,
			);
		}

		private _splitInterpolation(
			input: string,
			location: string,
			interpolationConfig: InterpolationConfig = DEFAULT_INTERPOLATION_CONFIG,
		) {
			const strings: InterpolationPiece[] = [];
			const expressions: InterpolationPiece[] = [];
			const offsets: number[] = [];
			const [interpolationStart, interpolationEnd] = interpolationConfig.from();
			let atInterpolation = false;
			let extendsLastString = false;
			let index = 0;

			while (index < input.length) {
				if (!atInterpolation) {
					const start = index;
					index = input.indexOf(interpolationStart, index);
					if (index === -1) {
						index = input.length;
					}
					const text = input.substring(start, index);
					strings.push({ text, start, end: index });
					atInterpolation = true;
				} else {
					const fullStart = index;
					const expressionStart = fullStart + interpolationStart.length;
					const expressionEnd = this._getInterpolationEndIndex(
						input,
						interpolationEnd,
						expressionStart,
					);

					if (expressionEnd === -1) {
						atInterpolation = false;
						extendsLastString = true;
						break;
					}

					const fullEnd = expressionEnd + interpolationEnd.length;

					const text = input.substring(expressionStart, expressionEnd);

					expressions.push({ text, start: fullStart, end: fullEnd });

					offsets.push(expressionStart);

					index = fullEnd;

					atInterpolation = false;
				}
			}

			if (!atInterpolation) {
				if (extendsLastString) {
					const piece = strings[strings.length - 1];
					piece.text += input.substring(index);
					piece.end = input.length;
				} else {
					strings.push({ text: input.substring(index), start: index, end: input.length });
				}
			}
			return new SplitInterpolation(strings, expressions, offsets);
		}
		private _getInterpolationEndIndex(input: string, interpolationEnd: string, start: number) {
			for (const index of this._forEachUnquoteChar(input, start)) {
				if (input.startsWith(interpolationEnd, index)) {
					return index;
				}
				if (input.startsWith("//")) {
					return input.indexOf(interpolationEnd, index);
				}
			}
			return -1;
		}

		private *_forEachUnquoteChar(input: string, start: number) {
			let currentQuote: string | null = null;
			let count = 0;
			for (let i = 0; i < input.length; i++) {
				const code = input.charCodeAt(i);
				const char = input.charAt(i);
				if (
					isQuote(code) &&
					(currentQuote === null || currentQuote === char) &&
					count % 2 === 0
				) {
					currentQuote = currentQuote === null ? char : null;
				} else if (currentQuote === null) {
					yield i;
				}
				// TODO
				count = char === "\\" ? count++ : count;
			}
		}
	}

	export class TemplateBindingParseResult {
		constructor(
			public templateBindings: ExpressionAST.TemplateBinding[],
			public warnings: string[],
			public errors: ExpressionAST.ParserError[],
		) {}
	}

	export class _ParseAST {
		public errors: ExpressionAST.ParserError[] = [];

		private _index: number = -1;

		constructor(private _input: string, private _tokens: ExpressionLexer.SyntaxToken[]) {
			this._advance();
		}

		private get _current() {
			return this._shouldStop() ? this._tokens[this._index] : EOF;
		}

		public parseExpression(): ExpressionAST.Node {
			return this._parseConditional();
		}

		public parseTemplateBindings(
			templateKey: ExpressionAST.TemplateBindingIdentifier,
		): TemplateBindingParseResult {
			const bindings: ExpressionAST.TemplateBinding[] = [];
			bindings.push(...this._parseDirectiveKeywordBinding(templateKey));
			while (this._shouldStop()) {
				const letBinding = this._parseLetBindings();
				if (letBinding) {
					bindings.push(letBinding);
				} else {
					const key = this._expectTemplateBindingKey();
					bindings.push(...this._parseDirectiveKeywordBinding(key));
				}
			}
			return new TemplateBindingParseResult(bindings, [], []);
		}

		private _parseLetBindings() {
			if (!this._current.isKeywordLet()) return null;
			this._advance();
			const key = this._expectTemplateBindingKey();
			let value: ExpressionAST.TemplateBindingIdentifier | null = null;
			return new ExpressionAST.VariableBinding(key, value, this._createSourceSpan());
		}

		private _parseDirectiveKeywordBinding(
			templateKey: ExpressionAST.TemplateBindingIdentifier,
		): ExpressionAST.TemplateBinding[] {
			const bindings: ExpressionAST.TemplateBinding[] = [];
			// skip colon
			this._attemptOptionalCharacter(CharCodes.Colon);
			const value = this._getDirectiveBoundTarget();
			bindings.push(
				new ExpressionAST.ExpressionBinding(templateKey, value, this._createSourceSpan()),
			);
			return bindings;
		}

		private _getDirectiveBoundTarget() {
			if (this._current.isKeywordLet()) return null;
			const ast = this.parseExpression();
			debugger;
			return new ExpressionAST.ASTWithSource(
				ast,
				this._createSpan(),
				this._createSourceSpan(),
			);
		}

		private _parseConditional(): ExpressionAST.Node {
			// condition ? expr : expr
			const condition = this._parseLogicalOr();
			if (this._attemptOptionalOperator("?")) {
				const left = this.parseExpression();
				let right: ExpressionAST.Node;
				if (this._attemptOptionalCharacter(CharCodes.Colon)) {
					right = this.parseExpression();
				} else {
					this._reportError(`Conditional expression  requires all 3 expressions`);
					right = new ExpressionAST.EmptyExpression(
						this._createSpan(),
						this._createSourceSpan(),
					);
				}
				return new ExpressionAST.Conditional(
					condition,
					left,
					right,
					this._createSpan(),
					this._createSourceSpan(),
				);
			}

			return condition;
		}

		private _parseLogicalOr(): ExpressionAST.Node {
			// ||
			let left = this._parseLogicalAnd();

			while (this._current.isOperator()) {
				if (this._attemptOptionalOperator("||")) {
					const right = this._parseLogicalAnd();
					left = new ExpressionAST.Binary(
						left,
						"||",
						right,
						this._createSpan(),
						this._createSourceSpan(),
					);
				}
				break;
			}

			return left;
		}

		private _shouldStop() {
			return this._index < this._tokens.length;
		}

		private _advance() {
			this._index++;
		}

		private _createSpan() {
			return null as unknown as ExpressionAST.ParseSpan;
		}

		private _createSourceSpan() {
			return null as unknown as ExpressionAST.AbsoluteSourceSpan;
		}

		private _parseLogicalAnd(): ExpressionAST.Node {
			// &&
			let left = this._parseNullishCoalescing();
			while (this._current.isOperator()) {
				if (this._attemptOptionalOperator("&&")) {
					const right = this._parseNullishCoalescing();
					left = new ExpressionAST.Binary(
						left,
						"&&",
						right,
						this._createSpan(),
						this._createSourceSpan(),
					);
				}
				break;
			}
			return left;
		}

		private _parseNullishCoalescing(): ExpressionAST.Node {
			// ??
			let left = this._parseEquality();
			while (this._current.isOperator()) {
				if (this._attemptOptionalOperator("??")) {
					const right = this._parseEquality();
					left = new ExpressionAST.Binary(
						left,
						"??",
						right,
						this._createSpan(),
						this._createSourceSpan(),
					);
				}
				break;
			}
			return left;
		}

		private _parseEquality(): ExpressionAST.Node {
			// == === != !==
			let left = this._parseRelational();
			while (this._current.isOperator()) {
				const operator = this._current.strValue;
				switch (operator) {
					case "!=":
					case "!==":
					case "==":
					case "===":
						this._advance();
						const right = this._parseRelational();
						left = new ExpressionAST.Binary(
							left,
							operator,
							right,
							this._createSpan(),
							this._createSourceSpan(),
						);
						continue;
				}
				break;
			}

			return left;
		}

		private _parseRelational(): ExpressionAST.Node {
			// < > >= <=
			let left = this._parseAdditive();
			while (this._current.isOperator()) {
				const operator = this._current.strValue;
				switch (operator) {
					case ">":
					case ">=":
					case "<":
					case "<=":
						const right = this._parseAdditive();
						left = new ExpressionAST.Binary(
							left,
							operator,
							right,
							this._createSpan(),
							this._createSourceSpan(),
						);
						continue;
				}
				break;
			}

			return left;
		}

		private _parseAdditive(): ExpressionAST.Node {
			// + -
			let left = this._parseMultiplicative();
			while (this._current.isOperator()) {
				const operator = this._current.strValue;
				switch (operator) {
					case "+":
					case "-":
						this._advance();
						const right = this._parseMultiplicative();
						left = new ExpressionAST.Binary(
							left,
							operator,
							right,
							this._createSpan(),
							this._createSourceSpan(),
						);
						continue;
				}
				break;
			}
			return left;
		}

		private _parseMultiplicative(): ExpressionAST.Node {
			// * / %
			let left = this._parsePrefix();
			while (this._current.isOperator()) {
				const operator = this._current.strValue;
				switch (operator) {
					case "*":
					case "/":
					case "%":
						this._advance();
						const right = this._parsePrefix();
						left = new ExpressionAST.Binary(
							left,
							operator,
							right,
							this._createSpan(),
							this._createSourceSpan(),
						);
						continue;
				}
				break;
			}
			return left;
		}

		private _parsePrefix(): ExpressionAST.Node {
			// +id !id -id
			if (this._current.isOperator()) {
				const operator = this._current.strValue;
				switch (operator) {
					case "+":
						this._advance();
						return ExpressionAST.Unary.createPlus(
							this._parsePrefix(),
							this._createSpan(),
							this._createSourceSpan(),
						);
					case "-":
						this._advance();
						return ExpressionAST.Unary.createMinus(
							this._parsePrefix(),
							this._createSpan(),
							this._createSourceSpan(),
						);
					case "!":
						this._advance();
						return new ExpressionAST.PrefixNot(
							this._parsePrefix(),
							this._createSpan(),
							this._createSourceSpan(),
						);
				}
			}
			return this._parseCallChain();
		}

		private _parseCallChain(): ExpressionAST.Node {
			//  identifier[expr]
			//  identifier.id
			//  identifier()
			//  identifier?.()
			//  identifier?.[expr]
			//  identifier?.id
			let left = this._parsePrimary();
			while (true) {
				if (this._attemptOptionalCharacter(CharCodes.Period)) {
					left = this._parseAccessMemberOrCall(left);
				} else if (this._attemptOptionalCharacter(CharCodes.Lbracket)) {
					left = this._parseKeyReadOrWrite(left);
				} else if (this._attemptOptionalCharacter(CharCodes.Lparen)) {
					const args = this._parseArguments();
					this._expectedCharacter(CharCodes.Rparen);
					left = new ExpressionAST.Call(
						args,
						left,
						this._createSpan(),
						this._createSourceSpan(),
						this._createSourceSpan(),
					);
				} else if (this._attemptOptionalOperator("?.")) {
					left = this._attemptOptionalCharacter(CharCodes.Lbracket)
						? this._parseKeyReadOrWrite(left, true)
						: this._parseAccessMemberOrCall(left, true);
				} else {
					return left;
				}
			}
		}

		private _parseKeyReadOrWrite(thisReceiver: ExpressionAST.Node, isSafe: boolean = false) {
			// TODO
			const expr = this.parseExpression();

			this._expectedCharacter(CharCodes.Rbracket);

			if (isSafe) {
				if (this._attemptOptionalOperator("=")) {
					this._reportError("The '?.' operator cannot be used in the assignment");
					return new ExpressionAST.EmptyExpression(
						this._createSpan(),
						this._createSourceSpan(),
					);
				} else {
					return new ExpressionAST.SafeKeyRead(
						expr,
						thisReceiver,
						this._createSpan(),
						this._createSourceSpan(),
						this._createSourceSpan(),
					);
				}
			} else {
				return this._attemptOptionalOperator("=")
					? new ExpressionAST.KeyWrite(
							expr,
							this.parseExpression(),
							thisReceiver,
							this._createSpan(),
							this._createSourceSpan(),
							this._createSourceSpan(),
					  )
					: new ExpressionAST.KeyRead(
							expr,
							thisReceiver,
							this._createSpan(),
							this._createSourceSpan(),
							this._createSourceSpan(),
					  );
			}
		}

		private _parsePrimary(): ExpressionAST.Node {
			if (this._attemptOptionalCharacter(CharCodes.Lparen)) {
				// (expr)
				const expression = this.parseExpression();
				this._expectedCharacter(CharCodes.Rparen);
				return expression;
			} else if (this._current.isKeyword()) {
				// keyword
				return this._parseKeyword();
			} else if (this._current.isNumber()) {
				// number
				const value = this._current.numValue;
				this._advance();
				return new ExpressionAST.LiteralPrimitive(
					value,
					this._createSpan(),
					this._createSourceSpan(),
				);
			} else if (this._current.isString()) {
				// string
				const value = this._current.strValue;
				this._advance();
				return new ExpressionAST.LiteralPrimitive(
					value,
					this._createSpan(),
					this._createSourceSpan(),
				);
			} else if (this._attemptOptionalCharacter(CharCodes.Lbracket)) {
				// array
				return this._parseExpressionList();
			} else if (this._attemptOptionalCharacter(CharCodes.Lbrace)) {
				// object
				return this._parseExpressionMap();
			} else if (this._current.isIdentifier()) {
				// identifier
				const thisReceiver = new ExpressionAST.ImplicitReceiver(
					this._createSpan(),
					this._createSourceSpan(),
				);
				return this._parseAccessMemberOrCall(thisReceiver);
			} else if (this._index >= this._input.length) {
				this._reportError("Unexpected end of expression: " + this._input);
				return new ExpressionAST.EmptyExpression(
					this._createSpan(),
					this._createSourceSpan(),
				);
			} else {
				this._reportError("Unexpected token " + this._current);
				return new ExpressionAST.EmptyExpression(
					this._createSpan(),
					this._createSourceSpan(),
				);
			}
		}

		private _parseAccessMemberOrCall(
			thisReceiver: ExpressionAST.ImplicitReceiver,
			isSafe: boolean = false,
		) {
			const id = this._expectedKeywordOrIdentifier() ?? "";

			let receiver: ExpressionAST.Node;

			if (isSafe) {
				if (this._attemptOptionalOperator("=")) {
					this._reportError("The '?.' operator cannot be used in the assignment");
					receiver = new ExpressionAST.EmptyExpression(
						this._createSpan(),
						this._createSourceSpan(),
					);
				} else {
					receiver = new ExpressionAST.SafePropertyRead(
						id,
						thisReceiver,
						this._createSpan(),
						this._createSourceSpan(),
						this._createSourceSpan(),
					);
				}
			} else {
				receiver = this._attemptOptionalOperator("=")
					? new ExpressionAST.PropertyWrite(
							id,
							this.parseExpression(),
							thisReceiver,
							this._createSpan(),
							this._createSourceSpan(),
							this._createSourceSpan(),
					  )
					: new ExpressionAST.PropertyRead(
							id,
							thisReceiver,
							this._createSpan(),
							this._createSourceSpan(),
							this._createSourceSpan(),
					  );
			}

			if (this._attemptOptionalCharacter(CharCodes.Lparen)) {
				const args = this._parseArguments();
				this._expectedCharacter(CharCodes.Rparen);
				return new ExpressionAST.Call(
					args,
					receiver,
					this._createSpan(),
					this._createSourceSpan(),
					this._createSourceSpan(),
				);
			}
			return receiver;
		}

		private _expectedKeywordOrIdentifier(): string | null {
			const current = this._current;
			this._advance();
			if (!current.isIdentifier() && current.isKeyword()) {
				this._reportError(
					`Unexpected ${this._prettyPrintToken(current)},expected Keyword Or Identifier`,
				);
				return null;
			}

			return current.toString() as string;
		}

		private _parseArguments() {
			const args: ExpressionAST.Node[] = [];
			do {
				if (this._current.isCharacter(CharCodes.Rparen)) break;
				args.push(this.parseExpression());
			} while (this._attemptOptionalCharacter(CharCodes.Comma));
			this._expectedCharacter(CharCodes.Rparen);
			return args;
		}

		private _parseExpressionMap() {
			// { "id":expr }
			// { name }

			// TODO
			// { [a]:expr }

			const keys: ExpressionAST.LiteralMapKey[] = [];

			const values: ExpressionAST.Node[] = [];

			let isQuote = false;

			do {
				if (this._current.isCharacter(CharCodes.Rbrace)) break;

				isQuote = this._current.isString();

				const key = this._parseExpressionMapKey();

				keys.push({
					key,
					isQuote,
				});

				if (isQuote) {
					// { "id": expr }
					this._expectedCharacter(CharCodes.Colon);
					values.push(this.parseExpression());
				} else if (this._attemptOptionalCharacter(CharCodes.Colon)) {
					// { 10 : expr }
					values.push(this.parseExpression());
				} else {
					// { id }
					values.push(
						new ExpressionAST.PropertyRead(
							key,
							new ExpressionAST.ImplicitReceiver(
								this._createSpan(),
								this._createSourceSpan(),
							),
							this._createSpan(),
							this._createSourceSpan(),
							this._createSourceSpan(),
						),
					);
				}
			} while (this._attemptOptionalCharacter(CharCodes.Comma));

			this._expectedCharacter(CharCodes.Rbrace);

			return new ExpressionAST.LiteralMap(
				keys,
				values,
				this._createSpan(),
				this._createSourceSpan(),
			);
		}

		private _parseExpressionMapKey() {
			const current = this._current;
			if (!current.isIdentifier() && !current.isString() && !current.isKeyword()) {
				// TODO
				this._reportError("Unexpected ,expected identifier, keyword, or string");
				return "";
			}
			this._advance();
			return current.toString() as string;
		}

		private _prettyPrintToken(token: ExpressionLexer.SyntaxToken) {
			return token === EOF ? "end of input" : `token ${token}`;
		}

		private _reportError(message: string): void {
			this.errors.push(new ExpressionAST.ParserError(message, this._input, "", null));
		}

		private _parseExpressionList() {
			const result: ExpressionAST.Node[] = [];
			do {
				if (this._current.isCharacter(CharCodes.Rbracket)) break;
				result.push(this.parseExpression());
			} while (this._attemptOptionalCharacter(CharCodes.Comma));
			this._expectedCharacter(CharCodes.Rbracket);
			return new ExpressionAST.LiteralArray(
				result,
				this._createSpan(),
				this._createSourceSpan(),
			);
		}

		private _parseKeyword() {
			if (this._current.isKeywordThis()) {
				this._advance();
				return new ExpressionAST.ImplicitReceiver(
					this._createSpan(),
					this._createSourceSpan(),
				);
			}

			let value: any;

			if (this._current.isKeywordTrue()) value = true;
			else if (this._current.isKeywordFalse()) value = false;
			else if (this._current.isKeywordUndefined()) value = void 0;
			else value = null;

			this._advance();

			return new ExpressionAST.LiteralPrimitive(
				value,
				this._createSpan(),
				this._createSourceSpan(),
			);
		}

		private _attemptOptionalOperator(op: string) {
			if (this._current.isOperator(op)) {
				this._advance();
				return true;
			}
			return false;
		}

		private _attemptOptionalCharacter(code: number) {
			if (this._current.isCharacter(code)) {
				this._advance();
				return true;
			}
			return false;
		}

		// private _expectedOperator(op: string) {
		// 	if (this._attemptOptionalOperator(op)) return;
		// }

		private _expectedCharacter(code: number) {
			if (this._attemptOptionalCharacter(code)) return;
		}

		private _expectTemplateBindingKey(): ExpressionAST.TemplateBindingIdentifier {
			let value = "";
			let operatorFound = false;

			do {
				value += this._current.strValue;
				operatorFound = this._attemptOptionalOperator("-");
				if (operatorFound) {
					value += "-";
				}
			} while (operatorFound);

			return { source: value };
		}
	}
}
