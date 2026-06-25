import { describe, expect, it } from "bun:test";
import { spawnProcess } from "@/utils/validatation";
import { join } from "node:path";
import { templateDir } from "@/core/constants";

describe("Verify integrity of contants ", () => {
	it("ensures the templateDir is correct; ensures that config.ts exists within the folder", async () => {
		const templateConfigFile = Bun.file(join(templateDir, "config.ts"));
		expect(templateConfigFile?.name).toEndWith("project_template/config.ts");
		expect(await templateConfigFile.exists()).toBe(true);
	});
});
