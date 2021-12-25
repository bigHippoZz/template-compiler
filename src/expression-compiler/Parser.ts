import { ExpressionLexer } from "./Lexer";
import { CharCodes } from "../html-compiler/CharCodes";
import { ExpressionAST } from "./AST";

export namespace ExpressionParser {
	export const EOF = new ExpressionLexer.SyntaxToken(
		-1,
		-1,
		ExpressionLexer.SyntaxTokenKind.Error,
		0,
		"",
	);

	export class Parser {}

	export class _ParseAST {
		public errors: ExpressionAST.ParserError[] = [];

		private _index: number = -1;

		constructor(private _input: string, private _tokens: ExpressionLexer.SyntaxToken[]) {
			this._advance();
		}

		private get _current() {
			return this._shouldStop() ? this._tokens[this._index] : EOF;
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

		public _parseExpression(): ExpressionAST.Node {
			return this._parseConditional();
		}

		private _parseConditional(): ExpressionAST.Node {
			// condition ? expr : expr
			const condition = this._parseLogicalOr();
			if (this._attemptOptionalOperator("?")) {
				const left = this._parseExpression();
				let right: ExpressionAST.Node;
				if (this._attemptOptionalCharacter(CharCodes.Colon)) {
					right = this._parseExpression();
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
			const expr = this._parseExpression();

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
							this._parseExpression(),
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
				const expression = this._parseExpression();
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
							this._parseExpression(),
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
				args.push(this._parseExpression());
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
					values.push(this._parseExpression());
				} else if (this._attemptOptionalCharacter(CharCodes.Colon)) {
					// { 10 : expr }
					values.push(this._parseExpression());
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
				result.push(this._parseExpression());
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
	}
}
