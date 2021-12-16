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

export class StackNode<T> {
	constructor(public value: T, public next: StackNode<T> | null = null) {}
	public toString(): string {
		return `value: ${this.value},next: ${this.next}`;
	}
}

export class Stack<T> {
	private _head: StackNode<T> | null = null;

	private _size: number = 0;

	public peek(): T | null {
		if (this.isEmpty()) {
			return null;
		}
		return this._head!.value;
	}
	public push(value: T): void {
		const node = new StackNode<T>(value);
		if (this.isEmpty()) {
			this._head = node;
		} else {
			node.next = this._head!;
			this._head = node;
		}
		this._size++;
	}

	public forwardToValue(untilFn: (v: T) => boolean): T | null {
		while (!this.isEmpty()) {
			const currentValue = this.pop()!;
			if (untilFn(currentValue)) return currentValue;
		}
		return null;
	}

	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}
		const node = this._head;
		this._head = node!.next;
		this._size--;
		return node!.value;
	}

	public isEmpty(): boolean {
		return this.size() === 0;
	}

	public size(): number {
		return this._size;
	}
}
