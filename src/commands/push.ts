import { outputAndExit } from "@/utils/utils";
import { exists } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { watch } from "node:fs";
import { join } from "node:path";
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

	/* Ensure config file exists. Skipped when using --noConfig */
	if ((await exists(join(cwd, "config.ts"))) && !flags.noConfig) outputAndExit(`Your project does not have a config.ts file. If you only want to push transpiled code, use '--noConfig'.`);

	if ((await exists(srcDir)) && !(await exists(distDir)))
		/* Create dist if it doesn't exist. Ensures srcDir exists to ensure its being ran within a project */
		await mkdir(distDir, { recursive: true });

	const tsFiles: Record<string, string> = {};
	const entryFileContents = []; // The 'export * from file' of every file to be transpiled - Paramount for the bundler to bundle it.
}

export async function push(options: PushFlags = {}) {
	const cwd = process.cwd();
	const srcDir = join(cwd, "src");

	if (!(await exists(srcDir))) outputAndExit(`The source directory does not exist. Ensure that you're running this process from the root of the project.`);

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

	if (!(await exists(srcDir))) outputAndExit(`The root directory provided (${rootDir}) does not have a 'src' directory within.`);

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
