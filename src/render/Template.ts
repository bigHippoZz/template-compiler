import { BindParser } from "src/bind/Parser";
import { ExpressionAST } from "../expression-compiler/AST";
import { TagAST } from "../html-compiler/AST";
import { RenderAST } from "./AST";

export const ATTR_PREFIX = "v-";

export const BINDING_DELIMS = {
	BANANA_BOX: { start: "[(", end: ")]" },
	PROPERTY: { start: "[", end: "]" },
	EVENT: { start: "(", end: ")" },
};

export class HtmlAstToRenderAst implements TagAST.Visitor {
	constructor(private _bindingParser: BindParser.Parser) {}
	public visitElement(element: TagAST.Element) {
		const tagName = element.name.toLowerCase();
		// skip style or script
		if (tagName === "script" || tagName === "style") return null;

		const parsedProperties: ExpressionAST.ParsedProperty[] = [];
		// 原生的属性
		const attributes: RenderAST.TextAttribute[] = [];
		// 绑定的事件
		const boundEvents: RenderAST.BoundEvent[] = [];

		const variables: RenderAST.Variable[] = [];

		const references: RenderAST.Reference[] = [];

		const templateParsedProperties: ExpressionAST.ParsedProperty[] = [];
		// 模板上的变量
		const templateVariables: RenderAST.Variable[] = [];

		let hasTemplateBinding = false;

		// attr
		for (const attr of element.attributes) {
			let hasBinding = false;

			// remove prefix data-xxx
			const normalizedAttrName = this._normalizeAttributeName(attr);

			if (attr.name.startsWith(ATTR_PREFIX)) {
				hasTemplateBinding = true;

				const templateValue = attr.value;
				const templateKey = normalizedAttrName.substring(ATTR_PREFIX.length);
				const parsedVariables: ExpressionAST.ParsedVariable[] = [];
				this._bindingParser.parseInlineTemplateBinding(
					templateKey,
					templateValue,
					null as any,
					null as any,
					[],
					templateParsedProperties,
					parsedVariables,
				);
				templateVariables.push(
					...parsedVariables.map((variable) => {
						return new RenderAST.Variable(
							variable.name,
							variable.value,
							variable.sourceSpan,
							variable.keySpan,
							variable.valueSpan,
						);
					}),
				);
			} else {
				hasBinding = this._parseAttribute(
					attr,
					[],
					parsedProperties,
					boundEvents,
					variables,
					references,
				);
			}

			if (!hasBinding && !hasTemplateBinding) {
				attributes.push(this.visitAttribute(attr));
			}
		}

		// children
		const children = TagAST.visitAll(this, element.children);

		let parsedElement: RenderAST.Node | undefined;

		const attrs = this._extractAttributes(element.name, parsedProperties);

		parsedElement = new RenderAST.Element(
			element.name,
			attributes,
			attrs.bound,
			boundEvents,
			children,
			references,
			element.sourceSpan,
			element.startSourceSpan,
			element.endSourceSpan,
		);

		if (hasTemplateBinding) {
			const attrs = this._extractAttributes("ng-template", templateParsedProperties);
			const templateAttrs: (RenderAST.TextAttribute | RenderAST.BoundAttribute)[] = [];
			attrs.literal.forEach((attr) => templateAttrs.push(attr));
			attrs.bound.forEach((attr) => templateAttrs.push(attr));

			const hoistedAttrs =
				parsedElement instanceof RenderAST.Element
					? {
							attributes: parsedElement.attributes,
							inputs: parsedElement.inputs,
							outputs: parsedElement.outputs,
					  }
					: { attributes: [], inputs: [], outputs: [] };

			parsedElement = new RenderAST.Template(
				(parsedElement as RenderAST.Element).name,
				hoistedAttrs.attributes,
				hoistedAttrs.inputs,
				hoistedAttrs.outputs,
				templateAttrs,
				[parsedElement],
				[
					/* no references */
				],
				templateVariables,
				element.sourceSpan,
				element.startSourceSpan,
				element.endSourceSpan,
			);
		}

		return parsedElement;
	}

	public visitAttribute(attribute: TagAST.Attribute) {
		return new RenderAST.TextAttribute(
			attribute.name,
			attribute.value,
			attribute.sourceSpan,
			attribute.keySourceSpan,
			attribute.valueSourceSpan,
		);
	}

	public visitText(text: TagAST.Text) {
		const expression = this._bindingParser.parseInterpolation(text.value, null as any);

		return expression
			? new RenderAST.BoundText(expression, null as any)
			: new RenderAST.Text(text.value, null as any);
	}

	public visitComment() {
		return null;
	}

	private _parseAttribute(
		attribute: TagAST.Attribute,
		matchableAttributes: string[][],
		parsedProperties: ExpressionAST.ParsedProperty[],
		boundEvents: RenderAST.BoundEvent[],
		variables: RenderAST.Variable[],
		references: RenderAST.Reference[],
	) {
		const name = this._normalizeAttributeName(attribute);
		const value = attribute.value;
		let delim: { start: string; end: string } | undefined = undefined;
		if (name.startsWith(BINDING_DELIMS.EVENT.start)) {
			delim = BINDING_DELIMS.EVENT;
		}
		if (delim !== undefined && name.endsWith(BINDING_DELIMS.EVENT.end)) {
			const identifier = name.substring(delim.start.length, name.length - delim.end.length);
			if (delim.start === BINDING_DELIMS.EVENT.start) {
				const events: ExpressionAST.ParsedEvent[] = [];
				this._bindingParser.parseEvent(
					identifier,
					value,
					null as any,
					null as any,
					matchableAttributes,
					events,
				);
				addEvent(events, boundEvents);
			}
			return true;
		}

		return false;
	}

	private _extractAttributes(elementName: string, properties: ExpressionAST.ParsedProperty[]) {
		const bound: RenderAST.BoundAttribute[] = [];
		const literal: RenderAST.TextAttribute[] = [];

		properties.forEach((prop) => {
			if (prop.isLiteral) {
				literal.push(new RenderAST.TextAttribute(prop.name, "", null as any, null as any));
			} else {
				bound.push(
					new RenderAST.BoundAttribute(
						prop.name,
						ExpressionAST.BindingType.Property,
						prop.expression,
						"",
						prop.sourceSpan,
						prop.sourceSpan,
						prop.sourceSpan,
					),
				);
			}
		});

		return { bound, literal };
	}

	private _normalizeAttributeName(attr: TagAST.Attribute) {
		return attr.name.replace(/^data-/gi, "");
	}
}

export function addEvent(events: ExpressionAST.ParsedEvent[], boundEvents: RenderAST.BoundEvent[]) {
	boundEvents.push(...events.map((e) => RenderAST.BoundEvent.fromParsedEvent(e)));
}
