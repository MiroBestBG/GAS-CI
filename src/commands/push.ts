import { outputAndExit } from "@/utils/utils";
import { mkdir } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { ConfigFile, ConfigSchema } from "@template/config";
import { Glob } from "bun";
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
	for await (const file of srcFileGlob.scan({ cwd: srcDir })) {
		const path = join(srcDir, file);
		tsFiles[path] = await Bun.file(join(srcDir, file)).text();
	}

	/* Bundle project */
	const tsConfigPath = join(cwd, "tsconfig.json");
	const tsconfigExists = await Bun.file(tsConfigPath).exists();
}

export async function push(options: PushFlags = {}) {
	const cwd = process.cwd();
	const srcDir = join(cwd, "src");

	if (!existsSync(srcDir)) outputAndExit(`The source directory does not exist. Ensure that you're running this process from the root of the project.`);

	await performPush(cwd, options);

	if (options?.watch) await watchDirectoryForChanges(cwd, options);

	process.exit(0); // Push complete

	/* Watch for changes in the 'src' directory */
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
