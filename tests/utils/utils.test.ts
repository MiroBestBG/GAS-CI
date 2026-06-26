import { describe, expect, spyOn, it } from "bun:test";
import { outputAndExit } from "@/utils/utils";

describe("outputAndExit()", () => {
	it("should call console.error with the message and exit the process", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

		const message = "Test error message";

		expect(() => outputAndExit(message)).toThrow("process.exit called");

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		expect(consoleSpy).toHaveBeenCalledWith(message);
		expect(exitSpy).toHaveBeenCalledTimes(1);
		expect(exitSpy).toHaveBeenCalledWith(1);

		exitSpy.mockRestore();
		consoleSpy.mockRestore();
	});

	it("should log the error object when provided", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

		const message = "Something broke";
		const error = new Error("underlying cause");

		expect(() => outputAndExit(message, error)).toThrow("process.exit called");

		expect(consoleSpy).toHaveBeenCalledTimes(2);
		expect(consoleSpy).toHaveBeenCalledWith(message);
		expect(consoleSpy).toHaveBeenCalledWith(error);

		exitSpy.mockRestore();
		consoleSpy.mockRestore();
	});
});
