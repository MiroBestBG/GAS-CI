import { test, describe, expect, spyOn } from "bun:test";
import { validate } from "../../src/utils/validatation";
import { z } from "zod";

const testSchema = z.string().min(3).max(20);

describe("validate()", () => {
	test("successful validation returns string", () => {
		expect(validate(testSchema, "valid", "Error", true)).toBe("valid");
		expect(validate(testSchema, "valid", "Error", false)).toBe("valid");
	});

	test("failed validation with exitUponFail=false returns undefined and logs", () => {
		const consoleSpy = spyOn(console, "log");
		const result = validate(testSchema, "ab", "Error msg", false);
		expect(result).toBeUndefined();
		expect(consoleSpy).toHaveBeenCalledTimes(2);
		consoleSpy.mockRestore();
	});

	test("failed validation with exitUponFail=true calls process.exit", () => {
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
