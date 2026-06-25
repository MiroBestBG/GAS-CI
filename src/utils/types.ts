import z from "zod";

export const ProjectNameSchema = z
	.string()
	.min(1, "You must provide a project name.")
	.regex(/^[a-zA-Z0-9_-]+$/, "Invalid project name. It should only contain letters, numbers, underscores, or hyphens.");

export const ScriptIdSchema = z
	.string()
	.regex(/^[a-zA-Z0-9_-]+$/, "Invalid script ID. It should only contain letters, numbers, underscores, or hyphens.")
	.optional();
