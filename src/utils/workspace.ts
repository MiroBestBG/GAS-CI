import { join, dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Glob } from "bun";

export function isWorkspaceRoot(dir: string): boolean {
	const pkgPath = join(dir, "package.json");
	if (!existsSync(pkgPath)) {
		return false;
	}
	try {
		const content = readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(content);
		return Array.isArray(pkg.workspaces);
	} catch {
		return false;
	}
}

export function findWorkspaceRoot(startDir: string): string | null {
	let current = resolve(startDir);
	while (true) {
		if (isWorkspaceRoot(current)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			// Reached filesystem root
			break;
		}
		current = parent;
	}
	return null;
}

export async function resolveWorkspaceProjects(rootDir: string): Promise<string[]> {
	const pkgPath = join(rootDir, "package.json");
	if (!existsSync(pkgPath)) {
		return [];
	}

	let workspaces: string[] = [];
	try {
		const content = readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(content);
		if (Array.isArray(pkg.workspaces)) {
			workspaces = pkg.workspaces;
		}
	} catch {
		return [];
	}

	const projects: Set<string> = new Set();

	for (const pattern of workspaces) {
		const glob = new Glob(pattern);
		for await (const match of glob.scan(rootDir)) {
			const fullPath = join(rootDir, match);
			const claspJsonPath = join(fullPath, ".clasp.json");
			if (existsSync(claspJsonPath)) {
				projects.add(fullPath);
			}
		}
	}

	return Array.from(projects).sort();
}
