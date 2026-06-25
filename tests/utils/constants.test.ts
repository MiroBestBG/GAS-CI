import { describe, expect, it } from "bun:test";
import { spawnProcess } from "@/utils/validatation";
import { join } from "node:path";
import { TEMPLATE_DIR } from "@/core/constants";

describe("Verify integrity of contants ", () => {
	it("ensures the TEMPLATE_DIR is correct; ensures that config.ts exists within the folder", async () => {
		const templateConfigFile = Bun.file(join(TEMPLATE_DIR, "config.ts"));
		expect(templateConfigFile?.name).toEndWith("project_template/config.ts");
		expect(await templateConfigFile.exists()).toBe(true);
	});
});
