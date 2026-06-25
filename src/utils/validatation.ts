import { z } from "zod";
import type { Spawn } from "bun";
import type { ZodType } from "zod";
/**
 * Validate input using a Zod Schema. Returns schema response of data.
 * Accepts any Zod schema and preserves its output type.
 * @param schema - Zod schema to validate against
 * @param input - Input string to validate
 * @param errorMessage - Error message to display on validation failure
 * @param exitUponFail - Exit process on validation failure (default: true)
 * @returns Validated schema output if successful, undefined if validation fails with exitUponFail=false
 */
export function validate<T extends ZodType>(schema: T, input: string | undefined, errorMessage: string, exitUponFail: true): z.infer<T>;
export function validate<T extends ZodType>(schema: T, input: string | undefined, errorMessage: string, exitUponFail: false): z.infer<T> | void;
export function validate<T extends ZodType>(schema: T, input: string | undefined, errorMessage: string, exitUponFail: boolean = true): z.infer<T> | void {
	const res = schema.safeParse(input);
	if (res.success) return res.data;

	console.log(`Error: ${res.error.issues[0]?.message}`);
	console.log(errorMessage);

	if (exitUponFail) process.exit(1);
}

/**
 *
 * @param cmd - Command to run (Array of commands eg ["bun", "run", "dev"])
 * @param cwd - Directory to do it within
 * @param stdin
 * @param stdout
 * @param stderr
 */
export async function spawnProcess(cmd: string[], cwd: string, stdin: Spawn.Writable = "inherit", stdout: Spawn.Readable = "inherit", stderr: Spawn.Readable = "inherit") {
	const proc = Bun.spawn(cmd, {
		cwd,
		stdin,
		stdout,
		stderr,
	});
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		throw new Error(`${cmd.join(" ")} failed with exit code ${exitCode}`);
	}
}
