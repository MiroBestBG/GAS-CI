import type { Spawn } from "bun";
import type { ZodType } from "zod";
/**
 * Validate input using a Zod Schema. Returns schema response of data.
 * @param schema - Zod schema to validate against
 * @param input - Input string to validate
 * @param errorMessage - Error message to display on validation failure
 * @param exitUponFail - Exit process on validation failure (default: true)
 * @returns Validated string if successful, undefined if validation fails with exitUponFail=false
 */
export function validate(schema: ZodType<string | undefined>, input: string | undefined, errorMessage: string, exitUponFail: true): string;
export function validate(schema: ZodType<string | undefined>, input: string | undefined, errorMessage: string, exitUponFail: false): string | void;
export function validate(schema: ZodType<string | undefined>, input: string | undefined, errorMessage: string, exitUponFail: boolean = true): string | void {
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
