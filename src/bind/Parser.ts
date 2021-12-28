import { ExpressionAST } from "../expression-compiler/AST";
import { ExpressionParser } from "src/expression-compiler/Parser";
import { ParseSourceSpan } from "src/html-compiler/ParseSourceFile";

export namespace BindParser {
	export class Parser {
		constructor(private _exprParser: ExpressionParser.Parser) {}
		public parseInlineTemplateBinding(
			templateKey: string,
			templateValue: string,
			sourceSpan: ParseSourceSpan,
			absoluteValueOffset: number,
			targetMatchableAttrs: string[][],
			targetProps: ExpressionAST.ParsedProperty[],
			targetVars: ExpressionAST.ParsedVariable[],
		) {
			const bindings = this._parseTemplateBindings(
				templateKey,
				templateValue,
				sourceSpan,
				-1,
				-1,
			);

			for (const binding of bindings.templateBindings) {
				if (binding instanceof ExpressionAST.VariableBinding) {
					const value = binding.value ? binding.value.source : "$implicit";
					targetVars.push(
						new ExpressionAST.ParsedVariable(
							binding.key.source,
							value,
							null as any,
							null as any,
						),
					);
				} else if (binding.value) {
					// TODO
					targetMatchableAttrs.push([binding.key.source, ""]);
					targetProps.push(
						new ExpressionAST.ParsedProperty(
							binding.key.source,
							binding.value,
							ExpressionAST.ParsedPropertyType.DEFAULT,
							null as any,
							null as any,
							null as any,
						),
					);
				} else {
					targetMatchableAttrs.push([binding.key.source, "" /* value */]);
					targetProps.push(
						new ExpressionAST.ParsedProperty(
							binding.key.source,
							new ExpressionAST.ASTWithSource(
								new ExpressionAST.LiteralPrimitive(null, null as any, null as any),
								null as any,
								null as any,
							),
							ExpressionAST.ParsedPropertyType.LITERAL_ATTR,
							null as any,
							null as any,
							null as any,
						),
					);
				}
			}
		}

		public parseInterpolation(value: string, sourceSpan: ParseSourceSpan) {
			return this._exprParser.parseInterpolation(value, value, -1);
		}

		public parseEvent(
			name: string,
			expression: string,
			sourceSpan: ParseSourceSpan,
			handlerSpan: ParseSourceSpan,
			targetMatchableAttrs: string[][],
			targetEvents: ExpressionAST.ParsedEvent[],
			keySpan?: ParseSourceSpan,
		) {
			return this._parseRegularEvent(
				name,
				expression,
				sourceSpan,
				handlerSpan,
				targetMatchableAttrs,
				targetEvents,
				keySpan,
			);
		}

		private _parseRegularEvent(
			name: string,
			expression: string,
			sourceSpan: ParseSourceSpan,
			handlerSpan: ParseSourceSpan,
			targetMatchableAttrs: string[][],
			targetEvents: ExpressionAST.ParsedEvent[],
			keySpan?: ParseSourceSpan,
		) {
			const ast = this._exprParser.parseAction(expression, expression, null as any);
			targetMatchableAttrs.push([name!, ""]);
			targetEvents.push(
				new ExpressionAST.ParsedEvent(
					name,
					null as any,
					ExpressionAST.ParsedEventType.Regular,
					ast,
					null as any,
					null as any,
					null as any,
				),
			);
		}

		private _parseTemplateBindings(
			tplKey: string,
			tplValue: string,
			sourceSpan: ParseSourceSpan,
			absoluteKeyOffset: number,
			absoluteValueOffset: number,
		) {
			return this._exprParser.parseTemplateBindings(
				tplKey,
				tplValue,
				absoluteKeyOffset,
				absoluteValueOffset,
			);
		}
	}
}
