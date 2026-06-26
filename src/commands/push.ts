import { outputAndExit } from "@/utils/utils";
import { mkdir } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { ConfigFile, ConfigSchema } from "@template/config";
import { Glob } from "bun";
import { parseSourceFile } from "@/utils/parser";
import { obfuscate } from "javascript-obfuscator";
interface PushFlags {
	watch?: boolean;
	noConfig?: boolean;
}
/**
 * @todo - Functionality
 */
export async function performPush(cwd: string, flags: PushFlags) {
	const srcDir = join(cwd, "src");
	const distDir = join(cwd, "dist");

	/* Get project config */
	var config: Partial<ConfigSchema> | undefined = undefined;

	if (!existsSync(join(cwd, "config.ts")) && !flags.noConfig) return outputAndExit(`Your project does not have a config.ts file. If you only want to push transpiled code, use '--noConfig'.`);

	try {
		config = await ((await import(join(cwd, "config.ts"))) as ConfigFile).config();
	} catch (err) {
		outputAndExit(`Your configuration file is malformed.`);
	}

	/* Create dist if it doesn't exist. Ensures srcDir exists to ensure its being ran within a project */
	if (existsSync(srcDir) && !existsSync(distDir)) await mkdir(distDir, { recursive: true });

	/* Obtain all ts files (To transpile) */
	const tsFiles: Record<string, string> = {};
	const srcFileGlob = new Glob("**/*.ts");
	const entryPointContents: string[] = [];
	var preservedFunctions = [];
	for await (const file of srcFileGlob.scan({ cwd: srcDir })) {
		const path = join(srcDir, file);
		const content = await Bun.file(join(srcDir, file)).text();

		const { preservedDeclarations, unexportedDeclarations } = parseSourceFile(content);
		const exportStatement = `export { ${unexportedDeclarations.join(",")} }`; // Export all unexported variables

		tsFiles[path] = [content, exportStatement].join("\n");
		entryPointContents.push(`export * from "./${file}";`);
		for (const preservedDeclaration of preservedDeclarations) {
			preservedFunctions.push(preservedDeclaration);
		}
	}

	/* Use tsconfig for bundling (if present) */
	const tsConfigPath = join(cwd, "tsconfig.json");
	const tsconfigExists = await Bun.file(tsConfigPath).exists();

	const res = await Bun.build({
		entrypoints: [join(srcDir, "_entrypoint.ts")],
		files: {
			[`${srcDir}/_entrypoint.ts`]: entryPointContents.join("\n"),
			...tsFiles,
		},
		target: "browser",
		format: "esm",
		...(tsconfigExists ? { tsconfig: tsConfigPath } : {}),
	});

	if (!res.success) outputAndExit(`Something went wrong when bundling the project.\n${res.logs.toString()}`);
	var sourceCode = await res.outputs[0]?.text();

	if (!sourceCode) outputAndExit(`The bundled source code returned undefined.`);

	if (config?.obfuscate?.enabled) {
		sourceCode = obfuscate(sourceCode, {
			reservedNames: preservedFunctions,
			...config.obfuscate.options,
		})
			.getObfuscatedCode()
			.toString();
	}

	/* Remove the last line of (export { ... }) since it breaks GAS*/
	sourceCode = sourceCode.replace(/export\s*{[^}]*};?\s*$/, "");
}

export async function push(options: PushFlags = {}) {
	const cwd = process.cwd();
	const srcDir = join(cwd, "src");

	if (!existsSync(srcDir)) outputAndExit(`The source directory does not exist. Ensure that you're running this process from the root of the project.`);

	await performPush(cwd, options);

	/* Watch for changes in the 'src' directory */
	if (options?.watch) await watchDirectoryForChanges(cwd, options);

	process.exit(0); // Push complete
}
/**
 * @param rootDir - The root project directory. The 'src' subdirectory within it will be watched.
 * @description Watches the 'src' directory of a project for file changes.
 * Upon detecting a change, triggers a push of the project.
 * Runs continuously until the process exits.
 */
async function watchDirectoryForChanges(rootDir: string, flags: PushFlags) {
	console.log(`Watching for changes in the 'src' directory of the project`);
	let isPushing = false;
	let timeout: ReturnType<typeof setTimeout> | null = null;
	const srcDir = join(rootDir, "src");

	if (!existsSync(srcDir)) outputAndExit(`The root directory provided (${rootDir}) does not have a 'src' directory within.`);

	watch(srcDir, { recursive: true }, (_, filename) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(async () => {
			if (isPushing) return;

			isPushing = true;
			console.log(`\nChange detected${filename ? `: ${filename}` : ""}. Pushing...`);

			try {
				await performPush(rootDir, flags);
				console.log(`Push complete. Watching for changes...`);
			} catch (error) {
				console.error(`Push failed:`, error);
			} finally {
				isPushing = false;
			}
		}, 500);
	});
}
