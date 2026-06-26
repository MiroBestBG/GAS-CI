import { describe, expect, it, spyOn, beforeEach, afterEach, mock, jest } from "bun:test";
import { join } from "node:path";

const mkdirMock = mock(() => Promise.resolve(undefined));
mock.module("node:fs/promises", () => ({
	mkdir: mkdirMock,
}));

let existsSyncResults: Record<string, boolean> = {};
const existsSyncMock = mock((path: string) => existsSyncResults[path] ?? false);

let watchCallback: ((event: string, filename: string | null) => void) | null = null;
const watchMock = mock((_path: string, _opts: unknown, cb: (event: string, filename: string | null) => void) => {
	watchCallback = cb;
	return { close: () => {} };
});

mock.module("node:fs", () => ({
	existsSync: existsSyncMock,
	watch: watchMock,
}));

const spawnProcessMock = mock(() => Promise.resolve(undefined));
mock.module("@/utils/validatation", () => ({
	spawnProcess: spawnProcessMock,
}));

let outputAndExitShouldThrow = true;
const outputAndExitMock = mock((_msg: string, _err?: unknown) => {
	if (outputAndExitShouldThrow) {
		throw new Error("process.exit called");
	}
	return undefined as never;
});
mock.module("@/utils/utils", () => ({
	outputAndExit: outputAndExitMock,
}));

const parseSourceFileMock = mock((_content: string) => ({
	unexportedDeclarations: ["hello"],
	preservedDeclarations: ["hello"],
}));
mock.module("@/utils/parser", () => ({
	parseSourceFile: parseSourceFileMock,
}));

const obfuscateMock = mock((_code: string, _opts: unknown) => ({
	getObfuscatedCode: () => ({ toString: () => "obfuscated_code();" }),
}));
mock.module("javascript-obfuscator", () => ({
	obfuscate: obfuscateMock,
}));

const { performPush, push } = await import("@/commands/push");

const TEST_PROJECT = join(import.meta.dir, "..", "_test_projects_", "bob");
const SRC_DIR = join(TEST_PROJECT, "src");
const DIST_DIR = join(TEST_PROJECT, "dist");

let consoleInfoSpy: ReturnType<typeof spyOn>;
let consoleLogSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	mkdirMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	existsSyncMock.mockReset().mockImplementation((path: string) => existsSyncResults[path] ?? false);
	spawnProcessMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	watchMock.mockReset().mockImplementation((_path: string, _opts: unknown, cb: (event: string, filename: string | null) => void) => {
		watchCallback = cb;
		return { close: () => {} };
	});
	parseSourceFileMock.mockReset().mockImplementation(() => ({
		unexportedDeclarations: ["hello"],
		preservedDeclarations: ["hello"],
	}));
	obfuscateMock.mockReset().mockImplementation(() => ({
		getObfuscatedCode: () => ({ toString: () => "obfuscated_code();" }),
	}));
	outputAndExitMock.mockReset().mockImplementation((_msg: string, _err?: unknown) => {
		if (outputAndExitShouldThrow) {
			throw new Error("process.exit called");
		}
		return undefined as never;
	});

	outputAndExitShouldThrow = true;
	existsSyncResults = {};
	watchCallback = null;
	jest.useFakeTimers();
	consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
	consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	jest.useRealTimers();
	consoleInfoSpy.mockRestore();
	consoleLogSpy.mockRestore();
	consoleErrorSpy.mockRestore();
});

describe("performPush()", () => {
	it("should call outputAndExit when config.ts is missing and noConfig is not set", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = false;

		await expect(performPush(TEST_PROJECT, {})).rejects.toThrow("process.exit called");

		expect(outputAndExitMock).toHaveBeenCalledWith(`Your project does not have a config.ts file. If you only want to push transpiled code, use '--noConfig'.`);
	});

	it("should call outputAndExit when config.ts import throws", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[DIST_DIR] = true;

		const fakeProject = join(TEST_PROJECT, "nonexistent_subdir");
		existsSyncResults[join(fakeProject, "config.ts")] = true;
		existsSyncResults[join(fakeProject, "src")] = true;
		existsSyncResults[join(fakeProject, "dist")] = true;

		await expect(performPush(fakeProject, {})).rejects.toThrow("process.exit called");

		expect(outputAndExitMock).toHaveBeenCalledWith("Your configuration file is malformed.");
	});

	it("should create dist directory when src exists but dist does not", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[DIST_DIR] = false;

		outputAndExitShouldThrow = false;

		await performPush(TEST_PROJECT, { noConfig: true }).catch(() => {});

		expect(mkdirMock).toHaveBeenCalledWith(DIST_DIR, { recursive: true });
	});

	it("should not create dist directory when it already exists", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[DIST_DIR] = true;

		outputAndExitShouldThrow = false;

		await performPush(TEST_PROJECT, { noConfig: true }).catch(() => {});

		expect(mkdirMock).not.toHaveBeenCalled();
	});

	it("should call parseSourceFile for each ts file in src", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[DIST_DIR] = true;

		outputAndExitShouldThrow = false;

		await performPush(TEST_PROJECT, { noConfig: true }).catch(() => {});

		expect(parseSourceFileMock).toHaveBeenCalled();
	});

	it("should call clasp push with the dist directory", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[DIST_DIR] = true;

		outputAndExitShouldThrow = false;

		await performPush(TEST_PROJECT, { noConfig: true }).catch(() => {});

		expect(spawnProcessMock).toHaveBeenCalledWith(["clasp", "push"], DIST_DIR);
	});

	it("should copy appsscript.json into dist when it exists in the project root", async () => {
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[DIST_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "appsscript.json")] = true;

		outputAndExitShouldThrow = false;

		await performPush(TEST_PROJECT, { noConfig: true }).catch(() => {});

		expect(spawnProcessMock).toHaveBeenCalledWith(["clasp", "push"], DIST_DIR);
	});
});

describe("push()", () => {
	it("should call outputAndExit when src directory does not exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		existsSyncResults[SRC_DIR] = false;

		await expect(push({})).rejects.toThrow("process.exit called");

		expect(outputAndExitMock).toHaveBeenCalledWith(`The source directory does not exist. Ensure that you're running this process from the root of the project.`);

		cwdSpy.mockRestore();
	});

	it("should call performPush and then process.exit(0) when not watching", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		outputAndExitShouldThrow = false;

		await expect(push({})).rejects.toThrow("process.exit(0)");

		expect(exitSpy).toHaveBeenCalledWith(0);

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it("should call watchDirectoryForChanges when --watch is set", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		outputAndExitShouldThrow = false;

		await expect(push({ watch: true })).rejects.toThrow("process.exit(0)");

		expect(watchMock).toHaveBeenCalled();
		expect(consoleLogSpy).toHaveBeenCalledWith("Watching for changes in the 'src' directory of the project");

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});
});

describe("watchDirectoryForChanges()", () => {
	it("should call outputAndExit when src directory does not exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		// src exists for the push() check; made invisible to watchDirectoryForChanges
		existsSyncMock.mockImplementation((path: string) => {
			if (path === SRC_DIR) {
				const result = existsSyncResults[path] ?? false;
				existsSyncResults[path] = false; // next call returns false
				return result;
			}
			return existsSyncResults[path] ?? false;
		});
		outputAndExitShouldThrow = false;

		// watchDirectoryForChanges will call outputAndExit since src won't exist on second check
		await expect(push({ watch: true })).rejects.toThrow("process.exit(0)");

		expect(outputAndExitMock).toHaveBeenCalled();

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it("should trigger a push when a file change is detected", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		outputAndExitShouldThrow = false;

		await expect(push({ watch: true })).rejects.toThrow("process.exit(0)");

		// Simulate a file change event
		expect(watchCallback).not.toBeNull();
		watchCallback!("change", "test.ts");

		jest.advanceTimersByTime(500);
		await Promise.resolve();

		expect(consoleLogSpy).toHaveBeenCalledWith("\nChange detected: test.ts. Pushing...");

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it("should log when a change is detected without a filename", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		outputAndExitShouldThrow = false;

		await expect(push({ watch: true })).rejects.toThrow("process.exit(0)");

		watchCallback!("change", null);

		jest.advanceTimersByTime(500);
		await Promise.resolve();

		expect(consoleLogSpy).toHaveBeenCalledWith("\nChange detected. Pushing...");

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it("should log an error when a triggered push fails", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		outputAndExitShouldThrow = false;

		await expect(push({ watch: true })).rejects.toThrow("process.exit(0)");

		// Make the next performPush call fail
		outputAndExitShouldThrow = true;

		watchCallback!("change", "fail.ts");

		jest.advanceTimersByTime(500);
		jest.useRealTimers();
		// Allow the async performPush chain inside the setTimeout callback to settle
		await new Promise((r) => setTimeout(r, 50));

		expect(consoleErrorSpy).toHaveBeenCalledWith("Push failed:", expect.any(Error));

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it("should debounce rapid file changes", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(TEST_PROJECT);
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit(0)");
		});

		existsSyncResults[SRC_DIR] = true;
		existsSyncResults[join(TEST_PROJECT, "config.ts")] = true;
		existsSyncResults[DIST_DIR] = true;
		outputAndExitShouldThrow = false;

		await expect(push({ watch: true })).rejects.toThrow("process.exit(0)");

		// Fire multiple rapid changes — only the last should trigger a push
		watchCallback!("change", "a.ts");
		watchCallback!("change", "b.ts");
		watchCallback!("change", "c.ts");

		jest.advanceTimersByTime(500);
		await Promise.resolve();

		// Only the last filename should appear in the log
		expect(consoleLogSpy).toHaveBeenCalledWith("\nChange detected: c.ts. Pushing...");

		cwdSpy.mockRestore();
		exitSpy.mockRestore();
	});
});
