import z from "zod";
import { ProjectNameSchema, ScriptIdSchema } from "@/utils/types";
import { spawnProcess, validate } from "@/utils/validatation";
export async function init(projectNameInput?: string, scriptIdInput?: string) {
	const projectName = validate(ProjectNameSchema, projectNameInput, `You must provide a valid project name.\nUsage: gas init <projectName> [scriptId]`, true);
	const scriptId = validate(z.optional(ScriptIdSchema), scriptIdInput, `Usage: gas init <projectName> [scriptId]`, true) as string | undefined; /* Handle edge case where user doesn't provide a scriptId */
}
