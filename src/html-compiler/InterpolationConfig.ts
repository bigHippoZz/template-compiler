export class InterpolationConfig {
	public static fromArray(marker?: Array<string>): InterpolationConfig {
		if (!marker) return DEFAULT_INTERPOLATION_CONFIG;
		return new InterpolationConfig(marker[0], marker[1]);
	}

	constructor(public readonly start: string, public readonly end: string) {}

	public from() {
		return [this.start, this.end];
	}
}

export const DEFAULT_INTERPOLATION_CONFIG = new InterpolationConfig('{{', '}}');
