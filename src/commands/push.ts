import { outputAndExit } from "@/utils/utils";
import { mkdir } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { join, basename, dirname } from "node:path";
import type { ConfigFile, ConfigSchema } from "@template/config";
import { Glob } from "bun";
import { parseSourceFile } from "@/utils/parser";
import { obfuscate } from "javascript-obfuscator";
import { spawnProcess } from "@/utils/validation";
import { readFile, writeFile } from "node:fs/promises";
import { isWorkspaceRoot, findWorkspaceRoot, resolveWorkspaceProjects } from "@/utils/workspace";
interface PushFlags {
	watch?: boolean;
	noConfig?: boolean;
}
/**
 * Loads a project's config.ts by dynamically importing it.
 * Returns undefined if the file doesn't exist or fails to load.
 */
async function loadProjectConfig(dir: string): Promise<Partial<ConfigSchema> | undefined> {
	const configPath = join(dir, "config.ts");
	if (!existsSync(configPath)) return undefined;

	try {
		return await ((await import(configPath)) as ConfigFile).config();
	} catch {
		return undefined;
	}
}

/**
 * Deep-merges two config objects. Values from `override` take precedence.
 * Nested objects are merged recursively; non-object values are replaced.
 */
function deepMerge<T extends Record<string, unknown>>(base: T | undefined, override: T | undefined): T {
	if (!base) return (override ?? {}) as T;
	if (!override) return base;

	const result = { ...base } as Record<string, unknown>;
	for (const key of Object.keys(override)) {
		const baseVal = result[key];
		const overrideVal = override[key];

		if (overrideVal !== null && typeof overrideVal === "object" && !Array.isArray(overrideVal) && baseVal !== null && typeof baseVal === "object" && !Array.isArray(baseVal)) {
			result[key] = deepMerge(baseVal as Record<string, unknown>, overrideVal as Record<string, unknown>);
		} else {
			result[key] = overrideVal;
		}
	}
	return result as T;
}

/**
 * Resolves the effective config for a project, supporting:
 * - Local config.ts with optional `extends` path (tsconfig-style inheritance chain)
 * - Fallback to workspace root config.ts when no local config exists
 */
async function resolveConfig(cwd: string, flags: PushFlags): Promise<Partial<ConfigSchema> | undefined> {
	if (flags.noConfig) return undefined;

	let config = await loadProjectConfig(cwd);

	if (config?.extends) {
		const parentDir = join(cwd, dirname(config.extends));
		const parentConfig = await loadProjectConfig(parentDir);
		config = deepMerge(parentConfig as Record<string, unknown>, config as Record<string, unknown>) as Partial<ConfigSchema>;
		delete config.extends;
	} else if (!config) {
		/* No local config — try workspace root */
		const wsRoot = findWorkspaceRoot(cwd);
		if (wsRoot && wsRoot !== cwd) {
			config = await loadProjectConfig(wsRoot);
		}
	}

	if (!config && !flags.noConfig) {
		outputAndExit(`Your project does not have a config.ts file. If you only want to push transpiled code, use '--noConfig'.`);
	}

	return config;
}

/**
 * Performs a push of the current project.
 *
 * This builds the TypeScript project from the `src` directory, optionally
 * applies obfuscation based on the project config, writes the result to
 * `dist/main.js`, and then executes `clasp push` from the dist directory.
 *
 * @param cwd - The working directory of the project.
 * @param flags - Optional flags for the push operation.
 * @param flags.watch - If true, the caller will also enable watch mode.
 * @param flags.noConfig - If true, skip requiring a `config.ts` file. Results in bundling using the tsconfig of the project.
 */
export async function performPush(cwd: string, flags: PushFlags) {
	const srcDir = join(cwd, "src");
	const distDir = join(cwd, "dist");

	/* Get project config (with extends/workspace inheritance) */
	const config = await resolveConfig(cwd, flags);

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

		/* Export all unexported declarations so cross-file imports still resolve. Tree-shaking is driven by the entrypoint, not by per-file exports. */
		const exportStatement = unexportedDeclarations.length > 0 ? `export { ${unexportedDeclarations.join(",")} }` : "";

		tsFiles[path] = [content, exportStatement].filter(Boolean).join("\n");

		/* Re-export only preserved names from the entrypoint so unreachable code gets eliminated */
		if (preservedDeclarations.length > 0) {
			entryPointContents.push(`export { ${preservedDeclarations.join(", ")} } from "./${file}";`);
		}

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
	sourceCode = sourceCode.replace(/export\s*\{[^}]*\};?/g, "");

	const distFileGlob = new Glob("**/*");
	for await (const file of distFileGlob.scan({ cwd: distDir })) {
		await Bun.file(join(distDir, file)).delete();
	}

	/* Write bundled source code to dist */
	await Bun.write(join(distDir, "main.js"), sourceCode);

	/* Attach appscript.json file to dist project */
	if (existsSync(join(cwd, "appsscript.json"))) {
		const appScriptFile = Bun.file(join(cwd, "appsscript.json"));
		await Bun.write(join(distDir, "appsscript.json"), await appScriptFile.text());
	}

	// Prevent dual appscript.json configurations (1 Source of truth)
	if (existsSync(join(srcDir, "appsscript.json"))) outputAndExit(`[WARNING] - Your appsscript.json must be in the root directory of your project, not your 'src' folder.`);

	/* Ensure .clasp.json rootDir points to dist so clasp only sees dist files */
	const claspJsonPath = join(cwd, ".clasp.json");
	if (existsSync(claspJsonPath)) {
		const claspConfig = JSON.parse(await readFile(claspJsonPath, "utf-8"));
		if (claspConfig.rootDir !== "dist") {
			claspConfig.rootDir = "dist";
			await writeFile(claspJsonPath, JSON.stringify(claspConfig, null, 2));
		}
	}

	/* Push using clasp */
	await spawnProcess(["clasp", "push"], cwd);
}

export async function push(options: PushFlags = {}) {
	const cwd = process.cwd();

	if (isWorkspaceRoot(cwd)) {
		/* Workspace mode: push all GAS projects */
		const projects = await resolveWorkspaceProjects(cwd);
		if (projects.length === 0) outputAndExit("No GAS projects found in workspace. Ensure sub-projects contain a .clasp.json file.");

		for (let i = 0; i < projects.length; i++) {
			console.log(`\nPushing project: ${basename(projects[i]!)} (${i + 1}/${projects.length})`);
			await performPush(projects[i]!, options);
		}

		if (options?.watch) {
			await watchWorkspace(cwd, projects, options);
		} else {
			process.exit(0);
		}
	} else {
		/* Single project mode */
		const srcDir = join(cwd, "src");
		if (!existsSync(srcDir)) outputAndExit(`The source directory does not exist. Ensure that you're running this process from the root of the project.`);

		await performPush(cwd, options);

		if (options?.watch) {
			await watchDirectoryForChanges(cwd, options);
		} else {
			process.exit(0);
		}
	}
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

/**
 * Watches all projects in a workspace for file changes.
 * When a change is detected, only the affected project is re-pushed.
 */
async function watchWorkspace(rootDir: string, projects: string[], flags: PushFlags) {
	console.log(`Watching ${projects.length} project(s) for changes`);
	const pushingProjects = new Set<string>();
	const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

	for (const projectDir of projects) {
		const srcDir = join(projectDir, "src");
		if (!existsSync(srcDir)) continue;

		watch(srcDir, { recursive: true }, (_, filename) => {
			const existing = timeouts.get(projectDir);
			if (existing) clearTimeout(existing);

			timeouts.set(
				projectDir,
				setTimeout(async () => {
					if (pushingProjects.has(projectDir)) return;

					pushingProjects.add(projectDir);
					console.log(`\nChange detected in ${basename(projectDir)}${filename ? `: ${filename}` : ""}. Pushing...`);

					try {
						await performPush(projectDir, flags);
						console.log(`Push complete for ${basename(projectDir)}. Watching for changes...`);
					} catch (error) {
						console.error(`Push failed for ${basename(projectDir)}:`, error);
					} finally {
						pushingProjects.delete(projectDir);
					}
				}, 500),
			);
		});
	}
}
