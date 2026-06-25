import z from "zod";

export const ProjectNameSchema = z
	.string()
	.min(1, "You must provide a project name.")
	.regex(/^[a-zA-Z0-9_-]+$/, "Invalid project name. It should only contain letters, numbers, underscores, or hyphens.");

export const ScriptIdSchema = z
	.string()
	.trim()
	.length(57, "Google Apps Script IDs are exactly 57 characters long. Make sure you're providing a Script ID!")
	.regex(/^[a-zA-Z0-9_-]+$/, "Script IDs can only contain letters, numbers, hyphens (-), and underscores (_).");
