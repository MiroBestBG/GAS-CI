import { join, basename } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import z from "zod";
import { ProjectNameSchema, ScriptIdSchema } from "@/utils/types";
import { spawnProcess, validate } from "@/utils/validation";
import { cp } from "node:fs/promises";
import { TEMPLATE_DIR } from "@/core/constants";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { copyFile, writeFile } from "node:fs/promises";
import { outputAndExit } from "@/utils/utils";
import { isWorkspaceRoot, findWorkspaceRoot } from "@/utils/workspace";

export async function init(projectNameInput?: string, scriptIdInput?: string, options?: { force?: boolean; mono?: boolean }) {
	const isCurrentDir = !projectNameInput && options?.force === true;
	let projectName = projectNameInput;

	if (!isCurrentDir) {
		projectName = validate(ProjectNameSchema, projectNameInput, `You must provide a valid project name.\nUsage: gas init <projectName> [scriptId]`, true);
	} else {
		projectName = basename(process.cwd());
	}

	const CWD = process.cwd();
	let NEW_PROJECT_DIR_PATH = isCurrentDir ? CWD : join(CWD, projectName as string);

	if (options?.mono) {
		if (existsSync(NEW_PROJECT_DIR_PATH) && !isCurrentDir) {
			if (options?.force == true) {
				await rm(NEW_PROJECT_DIR_PATH, { recursive: true, force: true });
			} else {
				await outputAndExit(`Workspace directory "${NEW_PROJECT_DIR_PATH}" already exists. Use --force to remove it.`);
			}
		}
		
		if (!isCurrentDir) {
			await mkdir(NEW_PROJECT_DIR_PATH).catch((err) => {
				outputAndExit(`Failed to create workspace directory at ${NEW_PROJECT_DIR_PATH}`, err);
			});
		}

		const workspacePkg = { name: projectName, private: true, workspaces: ["projects/*"] };
		await writeFile(join(NEW_PROJECT_DIR_PATH, "package.json"), JSON.stringify(workspacePkg, null, "\t"));

		await copyFile(join(TEMPLATE_DIR, "config.ts"), join(NEW_PROJECT_DIR_PATH, "config.ts")).catch((err) => outputAndExit(`Failed to copy shared config.ts.`, err));

		await mkdir(join(NEW_PROJECT_DIR_PATH, "projects")).catch((err) => outputAndExit(`Failed to create projects directory.`, err));

		console.log(`Initialised workspace '${projectName}'`);
		return;
	}

	const wsRoot = findWorkspaceRoot(CWD);
	if (wsRoot && !isCurrentDir) {
		NEW_PROJECT_DIR_PATH = join(wsRoot, "projects", projectName as string);
		console.log(`Creating project inside workspace at projects/${projectName}...`);
	}

	const scriptId = validate(z.optional(ScriptIdSchema), scriptIdInput, `You must provide a valid Google App Script project Script ID. Alternatively, leave the Script ID blank and choose your project from a dropdown.\nUsage: gas init <projectName> [scriptId]`, true);

	/* Ensure project directory doesn't already exist (If so, remove it if using --force.  Otherwise, exit.) */
	if (existsSync(NEW_PROJECT_DIR_PATH) && !isCurrentDir) {
		if (options?.force == true) {
			await rm(NEW_PROJECT_DIR_PATH, { recursive: true, force: true });
		} else {
			await outputAndExit(`Project directory "${NEW_PROJECT_DIR_PATH}" already exists. Use --force to remove it.`);
		}
	}
	/* Create project directory */
	if (!isCurrentDir) {
		await mkdir(NEW_PROJECT_DIR_PATH, { recursive: true }).catch((err) => {
			outputAndExit(`Failed to create project directory at ${NEW_PROJECT_DIR_PATH}`, err);
		});
	}

	/* Copy over files from the template to the new project directory */
	await cp(TEMPLATE_DIR, NEW_PROJECT_DIR_PATH, { recursive: true }).catch((err) => outputAndExit(`Something went wrong while copying template files into the project directory.`, err));

	/* Spawn clasp process */
	const cmd = scriptId ? ["clasp", "clone", scriptId] : ["clasp", "clone"];
	await spawnProcess(cmd, join(NEW_PROJECT_DIR_PATH, "dist")).catch((err) => outputAndExit(`Failed to clone Google Apps Script project. Ensure clasp is installed and you are authenticated.`, err));

	/* Install dependencies */
	await spawnProcess(["bun", "install"], NEW_PROJECT_DIR_PATH, "ignore", "ignore", "ignore").catch((err) => outputAndExit(`Failed to install dependencies with bun.`, err));

	/* Move .clasp.json file to NEW_PROJECT_DIR_PATH to ensure compatability in the future when pushing files from the dist folder. */
	if (existsSync(join(NEW_PROJECT_DIR_PATH, "dist", ".clasp.json"))) {
		await rename(join(NEW_PROJECT_DIR_PATH, "dist", ".clasp.json"), join(NEW_PROJECT_DIR_PATH, ".clasp.json")).catch((err) => outputAndExit(`Failed to move .clasp.json file.`, err));
	}

	/* Set rootDir to "dist" so clasp only scans the dist folder (prevents duplicate appsscript.json conflicts) */
	const claspJsonPath = join(NEW_PROJECT_DIR_PATH, ".clasp.json");
	if (existsSync(claspJsonPath)) {
		const claspConfig = JSON.parse(await import("node:fs/promises").then(m => m.readFile(claspJsonPath, "utf-8")));
		claspConfig.rootDir = "dist";
		await writeFile(claspJsonPath, JSON.stringify(claspConfig, null, 2));
	}

	/* Copy the appscript.json to NEW_PROJECT_DIR_PATH. Should the user remove their dist folder, the "gas push" command will detect said change and move the one from the folder over to the  */
	if (existsSync(join(NEW_PROJECT_DIR_PATH, "dist", "appsscript.json"))) {
		await copyFile(join(NEW_PROJECT_DIR_PATH, "dist", "appsscript.json"), join(NEW_PROJECT_DIR_PATH, "appsscript.json")).catch((err) => outputAndExit(`Failed to copy appsscript.json file.`, err));
	}

	if (wsRoot) {
		console.log(`Initialised project '${projectName}' in workspace at ${NEW_PROJECT_DIR_PATH}`);
	} else {
		console.log(`Initialised project '${projectName}'${scriptId ? ` with script ID: ${scriptId}` : ""}`);
	}
}
