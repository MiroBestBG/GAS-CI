import { ProjectNameSchema } from "../utils/types";
import { validate } from "../utils/validatation";

export async function init(projectName?: string, scriptId?: string) {
	projectName = validate(ProjectNameSchema, projectName, `Usage: gas init <projectName> [scriptId]`, true);
}
