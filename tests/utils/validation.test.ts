import { describe, expect, spyOn, it } from "bun:test";
import { spawnProcess, validate } from "@/utils/validatation";
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
	it("should succeed for a successful command", async () => {
		expect(spawnProcess(["echo", "hello"], process.cwd(), "pipe", "pipe", "pipe")).resolves.toBeUndefined();
	});

	it("should throw for a failing command", async () => {
		expect(spawnProcess(["false"], process.cwd(), "pipe", "pipe", "pipe")).rejects.toThrow("failed with exit code 1");
	});
});
