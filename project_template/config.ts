import { ObfuscatorOptions } from "javascript-obfuscator";
export type ConfigSchema = {
	obfuscate: {
		enabled: boolean;
		options: ObfuscatorOptions;
	};
};
export interface ConfigFile {
	config: () => Promise<ConfigSchema>;
}
export function config(): ConfigSchema {
	return {
		obfuscate: {
			enabled: true,
			options: {
				disableConsoleOutput: true,
				compact: true,
				controlFlowFlattening: false, // WARNING: Turned off for GAS compatibility
				identifierNamesGenerator: "hexadecimal",
				renameGlobals: true,
				inputFileName: "input.js",
				stringArray: true,
				rotateStringArray: true,
				sourceMap: true,
				sourceMapMode: "separate",
				sourceMapSourcesMode: "sources",
				sourceMapFileName: "sourcemap.js.map",
				target: "browser",
			} as ObfuscatorOptions,
		},
	};
}
