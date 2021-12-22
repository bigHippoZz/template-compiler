export class InterpolationConfig {
	public static fromArray(marker?: Array<string>): InterpolationConfig {
		if (!marker) return DEFAULT_INTERPOLATION_CONFIG;
		return new InterpolationConfig(marker[0], marker[1]);
	}
	constructor(public start: string, public end: string) {}
}

export const DEFAULT_INTERPOLATION_CONFIG = new InterpolationConfig('{{', '}}');
