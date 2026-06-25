import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import z from "zod";
import { ProjectNameSchema, ScriptIdSchema } from "@/utils/types";
import { spawnProcess, validate } from "@/utils/validatation";
import { cp } from "node:fs/promises";

export async function init(projectNameInput?: string, scriptIdInput?: string) {
	const projectName = validate(ProjectNameSchema, projectNameInput, `You must provide a valid project name.\nUsage: gas init <projectName> [scriptId]`, true);
	const scriptId = validate(z.optional(ScriptIdSchema), scriptIdInput, `You must provide a valid Google App Script project Script ID. Alternatively, leave the Script ID blank and choose your project from a dropdown.\nUsage: gas init <projectName> [scriptId]`, true) as string | undefined; /* Handle edge case where user doesn't provide a scriptId */

	const CWD = process.cwd();
	const NEW_PROJECT_DIR_PATH = join(CWD, projectName);

	/* Create project directory */
	await mkdir(NEW_PROJECT_DIR_PATH);

	/* Copy over the template into the new project folder */
}
