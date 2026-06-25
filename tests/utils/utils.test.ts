import { describe, expect, spyOn, it } from "bun:test";
import { outputAndExit } from "@/utils/utils";

describe("outputAndExit()", () => {
	it("should call console.error with the message and exit the process", async () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
		const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

		const message = "Test error message";

		await expect(outputAndExit(message)).rejects.toThrow("process.exit called");

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		expect(consoleSpy).toHaveBeenCalledWith(message);
		expect(exitSpy).toHaveBeenCalledTimes(1);
		expect(exitSpy).toHaveBeenCalledWith(1);

		exitSpy.mockRestore();
		consoleSpy.mockRestore();
	});
});
