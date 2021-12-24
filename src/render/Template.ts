import { TagAST } from "src/html-compiler/AST";

export const ATTR_PREFIX = ":";

export class HtmlAstToRenderAst implements TagAST.Visitor {
	visitElement(element: TagAST.Element, context: any) {
		if (element.name.toLowerCase() === "script" || element.name.toLowerCase() === "style")
			return null;

		// attr
		for (const attr of element.attributes) {
			// remove prefix data-xxx
			const normalizedAttributeName = this._normalizeAttributeName(attr);
			if (attr.name.startsWith(ATTR_PREFIX)) {
			} else {
			}
		}
	}

	private _normalizeAttributeName(attr: TagAST.Attribute) {
		return attr.name.replace(/^data-/gi, "");
	}

	visitAttribute(attribute: TagAST.Attribute, context: any) {
		throw new Error("Method not implemented.");
	}
	visitText(text: TagAST.Text, context: any) {
		throw new Error("Method not implemented.");
	}
	visitComment(comment: TagAST.Comment, context: any) {
		throw new Error("Method not implemented.");
	}
}
