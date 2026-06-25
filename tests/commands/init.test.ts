import { describe, expect, it, spyOn, beforeEach, afterEach, mock } from "bun:test";
import { join } from "node:path";

const mkdirMock = mock(() => Promise.resolve(undefined));
const rmMock = mock(() => Promise.resolve(undefined));
const cpMock = mock(() => Promise.resolve(undefined));
const renameMock = mock(() => Promise.resolve(undefined));
const copyFileMock = mock(() => Promise.resolve(undefined));

mock.module("node:fs/promises", () => ({
	mkdir: mkdirMock,
	rm: rmMock,
	cp: cpMock,
	rename: renameMock,
	copyFile: copyFileMock,
}));

let existsSyncResults: Record<string, boolean> = {};
const existsSyncMock = mock((path: string) => existsSyncResults[path] ?? false);

mock.module("node:fs", () => ({
	existsSync: existsSyncMock,
}));

const spawnProcessMock = mock(() => Promise.resolve(undefined));
const validateMock = mock((_schema: unknown, input: unknown, _msg: string, _exit: boolean) => input);

mock.module("@/utils/validatation", () => ({
	spawnProcess: spawnProcessMock,
	validate: validateMock,
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

mock.module("@/core/constants", () => ({
	TEMPLATE_DIR: "/fake/template",
}));

const { init } = await import("@/commands/init");

const CWD = process.cwd();
const PROJECT = "my-project";
const SCRIPT_ID = "a".repeat(57); // valid 57-char id
const PROJECT_DIR = join(CWD, PROJECT);

let consoleLogSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	/* Reset all mocks */
	mkdirMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	rmMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	cpMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	renameMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	copyFileMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	existsSyncMock.mockReset().mockImplementation((path: string) => existsSyncResults[path] ?? false);
	spawnProcessMock.mockReset().mockImplementation(() => Promise.resolve(undefined));
	validateMock.mockReset().mockImplementation((_schema: unknown, input: unknown) => input);
	outputAndExitMock.mockReset().mockImplementation((_msg: string, _err?: unknown) => {
		if (outputAndExitShouldThrow) {
			throw new Error("process.exit called");
		}
		return undefined as never;
	});

	outputAndExitShouldThrow = true;
	existsSyncResults = {};
	consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	consoleLogSpy.mockRestore();
});

describe("init()", () => {
	it("should initialise a project without a scriptId", async () => {
		await init(PROJECT, undefined, {});
		expect(validateMock).toHaveBeenCalledTimes(2);

		expect(mkdirMock).toHaveBeenCalledWith(PROJECT_DIR);
		expect(cpMock).toHaveBeenCalledWith("/fake/template", PROJECT_DIR, { recursive: true });

		expect(spawnProcessMock).toHaveBeenCalledWith(["clasp", "clone"], join(PROJECT_DIR, "dist"));
		expect(spawnProcessMock).toHaveBeenCalledWith(["bun", "install"], PROJECT_DIR, "ignore", "ignore", "ignore");

		expect(renameMock).not.toHaveBeenCalled();
		expect(copyFileMock).not.toHaveBeenCalled();

		expect(consoleLogSpy).toHaveBeenCalledWith(`Initialised project '${PROJECT}'`);
	});

	it("should initialise a project with a scriptId", async () => {
		await init(PROJECT, SCRIPT_ID, {});

		expect(spawnProcessMock).toHaveBeenCalledWith(["clasp", "clone", SCRIPT_ID], join(PROJECT_DIR, "dist"));

		expect(consoleLogSpy).toHaveBeenCalledWith(`Initialised project '${PROJECT}' with script ID: ${SCRIPT_ID}`);
	});

	it("should remove the existing directory when --force is true", async () => {
		existsSyncResults[PROJECT_DIR] = true;

		await init(PROJECT, undefined, { force: true });

		expect(rmMock).toHaveBeenCalledWith(PROJECT_DIR, { recursive: true, force: true });
		expect(mkdirMock).toHaveBeenCalledWith(PROJECT_DIR);
	});

	it("should call outputAndExit when directory exists and --force is not set", async () => {
		existsSyncResults[PROJECT_DIR] = true;

		await expect(init(PROJECT, undefined, {})).rejects.toThrow("process.exit called");

		expect(outputAndExitMock).toHaveBeenCalledWith(`Project directory "${PROJECT_DIR}" already exists. Use --force to remove it.`);
		expect(mkdirMock).not.toHaveBeenCalled();
	});

	it("should call outputAndExit when directory exists and options is undefined", async () => {
		existsSyncResults[PROJECT_DIR] = true;

		await expect(init(PROJECT, undefined, undefined)).rejects.toThrow("process.exit called");

		expect(outputAndExitMock).toHaveBeenCalled();
	});

	it("should call outputAndExit when mkdir fails", async () => {
		outputAndExitShouldThrow = false;
		const mkdirError = new Error("EACCES");
		mkdirMock.mockImplementation(() => Promise.reject(mkdirError));

		await init(PROJECT, undefined, {});

		expect(outputAndExitMock).toHaveBeenCalledWith(`Failed to create project directory at ${PROJECT_DIR}`, mkdirError);
	});

	it("should call outputAndExit when cp (template copy) fails", async () => {
		outputAndExitShouldThrow = false;
		const cpError = new Error("cp failed");
		cpMock.mockImplementation(() => Promise.reject(cpError));

		await init(PROJECT, undefined, {});

		expect(outputAndExitMock).toHaveBeenCalledWith("Something went wrong while copying template files into the project directory.", cpError);
	});

	it("should call outputAndExit when clasp clone fails", async () => {
		outputAndExitShouldThrow = false;
		const claspError = new Error("clasp failed");
		spawnProcessMock.mockImplementationOnce(() => Promise.reject(claspError));

		await init(PROJECT, undefined, {});

		expect(outputAndExitMock).toHaveBeenCalledWith("Failed to clone Google Apps Script project. Ensure clasp is installed and you are authenticated.", claspError);
	});

	it("should call outputAndExit when bun install fails", async () => {
		outputAndExitShouldThrow = false;
		const bunError = new Error("bun install failed");

		spawnProcessMock.mockImplementationOnce(() => Promise.resolve(undefined)).mockImplementationOnce(() => Promise.reject(bunError));

		await init(PROJECT, undefined, {});

		expect(outputAndExitMock).toHaveBeenCalledWith("Failed to install dependencies with bun.", bunError);
	});

	it("should move .clasp.json from dist to project root when it exists", async () => {
		existsSyncResults[join(PROJECT_DIR, "dist", ".clasp.json")] = true;

		await init(PROJECT, undefined, {});

		expect(renameMock).toHaveBeenCalledWith(join(PROJECT_DIR, "dist", ".clasp.json"), join(PROJECT_DIR, ".clasp.json"));
	});

	it("should not rename when .clasp.json does not exist in dist", async () => {
		existsSyncResults[join(PROJECT_DIR, "dist", ".clasp.json")] = false;

		await init(PROJECT, undefined, {});

		expect(renameMock).not.toHaveBeenCalled();
	});

	it("should call outputAndExit when rename of .clasp.json fails", async () => {
		outputAndExitShouldThrow = false;
		existsSyncResults[join(PROJECT_DIR, "dist", ".clasp.json")] = true;
		const renameError = new Error("rename failed");
		renameMock.mockImplementation(() => Promise.reject(renameError));

		await init(PROJECT, undefined, {});

		expect(outputAndExitMock).toHaveBeenCalledWith("Failed to move .clasp.json file.", renameError);
	});

	it("should copy appsscript.json from dist to project root when it exists", async () => {
		existsSyncResults[join(PROJECT_DIR, "dist", "appsscript.json")] = true;

		await init(PROJECT, undefined, {});

		expect(copyFileMock).toHaveBeenCalledWith(join(PROJECT_DIR, "dist", "appsscript.json"), join(PROJECT_DIR, "appsscript.json"));
	});

	it("should not copy when appsscript.json does not exist in dist", async () => {
		existsSyncResults[join(PROJECT_DIR, "dist", "appsscript.json")] = false;

		await init(PROJECT, undefined, {});

		expect(copyFileMock).not.toHaveBeenCalled();
	});

	it("should call outputAndExit when copyFile of appsscript.json fails", async () => {
		outputAndExitShouldThrow = false;
		existsSyncResults[join(PROJECT_DIR, "dist", "appsscript.json")] = true;
		const copyError = new Error("copy failed");
		copyFileMock.mockImplementation(() => Promise.reject(copyError));

		await init(PROJECT, undefined, {});

		expect(outputAndExitMock).toHaveBeenCalledWith("Failed to copy appsscript.json file.", copyError);
	});

	it("should handle both .clasp.json and appsscript.json existing", async () => {
		existsSyncResults[join(PROJECT_DIR, "dist", ".clasp.json")] = true;
		existsSyncResults[join(PROJECT_DIR, "dist", "appsscript.json")] = true;

		await init(PROJECT, undefined, {});

		expect(renameMock).toHaveBeenCalled();
		expect(copyFileMock).toHaveBeenCalled();
	});

	it("should call outputAndExit when dir exists and force is explicitly false", async () => {
		existsSyncResults[PROJECT_DIR] = true;

		await expect(init(PROJECT, undefined, { force: false })).rejects.toThrow("process.exit called");

		expect(outputAndExitMock).toHaveBeenCalled();
		expect(rmMock).not.toHaveBeenCalled();
	});
});
