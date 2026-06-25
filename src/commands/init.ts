import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import z from "zod";
import { ProjectNameSchema, ScriptIdSchema } from "@/utils/types";
import { spawnProcess, validate } from "@/utils/validatation";
import { cp } from "node:fs/promises";
import { TEMPLATE_DIR } from "@/core/constants";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { copyFile } from "node:fs/promises";
import { outputAndExit } from "@/utils/utils";
export async function init(projectNameInput?: string, scriptIdInput?: string, options?: { force?: boolean }) {
	const projectName = validate(ProjectNameSchema, projectNameInput, `You must provide a valid project name.\nUsage: gas init <projectName> [scriptId]`, true);
	const scriptId = validate(z.optional(ScriptIdSchema), scriptIdInput, `You must provide a valid Google App Script project Script ID. Alternatively, leave the Script ID blank and choose your project from a dropdown.\nUsage: gas init <projectName> [scriptId]`, true);

	const CWD = process.cwd();
	const NEW_PROJECT_DIR_PATH = join(CWD, projectName);

	/* Ensure project directory doesn't already exist (If so, remove it if using --force.  Otherwise, exit.) */
	if (existsSync(NEW_PROJECT_DIR_PATH)) {
		if (options?.force == true) {
			await rm(NEW_PROJECT_DIR_PATH, { recursive: true, force: true });
		} else {
			await outputAndExit(`Project directory "${NEW_PROJECT_DIR_PATH}" already exists. Use --force to remove it.`);
		}
	}
	/* Create project directory */
	await mkdir(NEW_PROJECT_DIR_PATH).catch((err) => {
		outputAndExit(`Failed to create project directory at ${NEW_PROJECT_DIR_PATH}`, err);
	});

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

	/* Copy the appscript.json to NEW_PROJECT_DIR_PATH. Should the user remove their dist folder, the "gas push" command will detect said change and move the one from the folder over to the  */
	if (existsSync(join(NEW_PROJECT_DIR_PATH, "dist", "appsscript.json"))) {
		await copyFile(join(NEW_PROJECT_DIR_PATH, "dist", "appsscript.json"), join(NEW_PROJECT_DIR_PATH, "appsscript.json")).catch((err) => outputAndExit(`Failed to copy appsscript.json file.`, err));
	}

	console.log(`Initialised project '${projectName}'${scriptId ? ` with script ID: ${scriptId}` : ""}`);
}
