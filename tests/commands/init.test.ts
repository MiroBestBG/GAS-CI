import { test, expect } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnProcess } from "@/utils/validatation";
import { existsSync } from "node:fs";
const TESTING_PROJECTS_DIR = join(import.meta.dirname, "_test_projects_");

async function cleanTemp(projectName: string) {
	await rm(join(TESTING_PROJECTS_DIR, projectName), { recursive: true, force: true });
}
const fakeScriptId = "09uEE6SP0HEkyVHBMetqEAzwHyI9BwI1N1-U3CzGmj4-pACjpAAAehHqw";
test.todo("init --force removes an existing project directory", async () => {
	const projectName = "init-force-functionality";
	const projectDir = join(TESTING_PROJECTS_DIR, projectName);

	await cleanTemp(projectName);
	await mkdir(projectDir, { recursive: true });
	expect(existsSync(projectDir)).toBeTrue();

	await spawnProcess(["gas", "init", projectName, fakeScriptId, "--force"], projectDir, "ignore", "ignore", "ignore");

	/* Ensure directory project was created */
	expect(existsSync(projectDir)).toBe(true);
});
