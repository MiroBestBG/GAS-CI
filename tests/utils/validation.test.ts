import { describe, expect, spyOn, it } from "bun:test";
import { spawnProcess, validate } from "@/utils/validation";
import { z } from "zod";

const testSchema = z.string().min(3).max(20);

describe("validate()", () => {
	it("should successfully validate the input; returns a valid string", () => {
		expect(validate(testSchema, "valid", "Error", true)).toBe("valid");
		expect(validate(testSchema, "valid", "Error", false)).toBe("valid");
	});

	it("should fail validation with exitUponFail=false; returns undefined and logs", () => {
		const consoleSpy = spyOn(console, "log");
		const result = validate(testSchema, "ab", "Error msg", false);
		expect(result).toBeUndefined();
		expect(consoleSpy).toHaveBeenCalledTimes(2);
		consoleSpy.mockRestore();
	});

	it("should fail validation with exitUponFail=true; calls process.exit", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});
		const consoleSpy = spyOn(console, "log");

		expect(() => validate(testSchema, "ab", "Error msg", true)).toThrow("exit");
		expect(consoleSpy).toHaveBeenCalledTimes(2);

		exitSpy.mockRestore();
		consoleSpy.mockRestore();
	});
});

describe("spawnProcess()", () => {
	it("should succeed for a command that exits with code 0", async () => {
		const cmd = ["bun", "-e", "process.exit(0)"];

		await expect(spawnProcess(cmd, process.cwd(), "ignore", "ignore", "ignore")).resolves.toBeUndefined();
	});

	it("should throw an error for a command that exits with a non-zero code", async () => {
		const cmd = ["bun", "-e", "process.exit(1)"];

		await expect(spawnProcess(cmd, process.cwd(), "ignore", "ignore", "ignore")).rejects.toThrow("bun -e process.exit(1) failed with exit code 1");
	});

	it("should succeed when streams are set to inherit", async () => {
		const cmd = ["bun", "-e", "process.exit(0)"];
		await expect(spawnProcess(cmd, process.cwd(), "inherit", "inherit", "inherit")).resolves.toBeUndefined();
	});
});
