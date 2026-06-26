import { outputAndExit } from "@/utils/utils";
import { exists } from "node:fs/promises";
import { watch } from "node:fs";
import { join } from "node:path";
/**
 * @todo - Functionality
 */
export async function performPush(cwd: string) {
	console.log(`Pushing`);
	await Bun.sleep(1000);
	console.log(`Pushed files`);
}

export async function push(options: { watch?: boolean } = {}) {
	const cwd = process.cwd();
	const srcDir = join(cwd, "src");

	if (!(await exists(srcDir))) outputAndExit(`The source directory does not exist. Ensure that you're running this process from the root of the project.`);

	await performPush(cwd);

	if (options.watch) await watchDirectoryForChanges(cwd);

	process.exit(0); // Push complete

	/* Watch for changes in the 'src' directory */
}
/**
 * @param rootDir - The root project directory. The 'src' subdirectory within it will be watched.
 * @description Watches the 'src' directory of a project for file changes.
 * Upon detecting a change, triggers a push of the project.
 * Runs continuously until the process exits.
 */
async function watchDirectoryForChanges(rootDir: string) {
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
				await performPush(rootDir);
				console.log(`Push complete. Watching for changes...`);
			} catch (error) {
				console.error(`Push failed:`, error);
			} finally {
				isPushing = false;
			}
		}, 500);
	});
}
