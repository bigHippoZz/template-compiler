export const remove = <T>(arr: T[], el: T): boolean => {
	const i = arr.indexOf(el);
	if (i > -1) {
		arr.splice(i, 1);
		return true;
	}
	return false;
};

export const isString = (val: unknown): val is string =>
	typeof val === "string";

export const isNumber = (val: unknown): val is number =>
	typeof val === "number";

export const isBoolean = (val: unknown): val is boolean =>
	typeof val === "boolean";

export const isObject = (val: unknown): val is Record<any, any> =>
	val !== null && typeof val === "object";

export const isSymbol = (val: unknown): val is symbol =>
	typeof val === "symbol";

export const isArray = Array.isArray;
