import type { ZodType } from "zod";
import { ScriptIdSchema } from "./types";

/**
 * Validate input using a Zod Schema. Returns schema response of data.
 * @param schema - Zod schema to validate against
 * @param input - Input string to validate
 * @param errorMessage - Error message to display on validation failure
 * @param exitUponFail - Exit process on validation failure (default: true)
 * @returns Validated string if successful, undefined if validation fails with exitUponFail=false
 */
export function validate(schema: ZodType<string>, input: string | undefined, errorMessage: string, exitUponFail: true): string;
export function validate(schema: ZodType<string>, input: string | undefined, errorMessage: string, exitUponFail: false): string | void;
export function validate(schema: ZodType<string>, input: string | undefined, errorMessage: string, exitUponFail: boolean = true): string | void {
	const res = schema.safeParse(input);
	if (res.success) return res.data;

	console.log(`Error: ${res.error.issues[0]?.message}`);
	console.log(errorMessage);

	if (exitUponFail) process.exit(1);
}
