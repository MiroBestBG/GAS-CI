import { describe, expect, it } from "bun:test";
import { parseSourceFile } from "@/utils/parser";

describe("parseSourceFile()", () => {
	it("should return empty metadata for an empty file", () => {
		const result = parseSourceFile("");
		expect(result).toEqual({
			unexportedDeclarations: [],
			preservedDeclarations: [],
		});
	});

	it("should ignore statements it doesn't handle (e.g. type aliases, interfaces)", () => {
		const result = parseSourceFile(`
			type Foo = string;
			interface Bar { x: number; }
		`);
		expect(result.unexportedDeclarations).toEqual([]);
		expect(result.preservedDeclarations).toEqual([]);
	});

	describe("unexported declarations", () => {
		it("should collect non-exported function declarations", () => {
			const result = parseSourceFile(`
				function foo() {}
				function bar() {}
			`);
			expect(result.unexportedDeclarations).toEqual(["foo", "bar"]);
		});

		it("should collect non-exported class declarations", () => {
			const result = parseSourceFile(`class Internal {}`);
			expect(result.unexportedDeclarations).toContain("Internal");
		});

		it("should collect non-exported variable declarations", () => {
			const result = parseSourceFile(`const x = 1;`);
			expect(result.unexportedDeclarations).toContain("x");
		});

		it("should handle multiple declarations in a single variable statement", () => {
			const result = parseSourceFile(`const a = 1, b = () => {}, c = "hello";`);
			expect(result.unexportedDeclarations).toEqual(["a", "b", "c"]);
		});

		it("should skip destructured variable names", () => {
			const result = parseSourceFile(`const { a, b } = obj;`);
			expect(result.unexportedDeclarations).toEqual([]);
		});

		it("should not include exported declarations", () => {
			const result = parseSourceFile(`
				export function pub() {}
				function priv() {}
			`);
			expect(result.unexportedDeclarations).toEqual(["priv"]);
		});
	});

	describe("preserved declarations", () => {
		it("should include a non-exported declaration with @preserveName", () => {
			const result = parseSourceFile(`
				/** @preserveName */
				function internal() {}
			`);
			expect(result.preservedDeclarations).toContain("internal");
		});

		it("should include an exported declaration with @preserveName", () => {
			const result = parseSourceFile(`
				/** @preserveName */
				export function keep() {}
			`);
			expect(result.preservedDeclarations).toContain("keep");
		});

		it("should include a declaration with @public", () => {
			const result = parseSourceFile(`
				/** @public */
				function publicFn() {}
			`);
			expect(result.preservedDeclarations).toContain("publicFn");
		});

		it("should include a class with @preserveName", () => {
			const result = parseSourceFile(`
				/** @preserveName */
				class Important {}
			`);
			expect(result.preservedDeclarations).toContain("Important");
		});

		it("should include variables with @preserveName", () => {
			const result = parseSourceFile(`
				/** @preserveName */
				const handler = () => {};
			`);
			expect(result.preservedDeclarations).toContain("handler");
		});

		it("should not mark declarations without comments as preserved", () => {
			const result = parseSourceFile(`
				function plain() {}
				class Plain {}
				const v = 1;
			`);
			expect(result.preservedDeclarations).toEqual([]);
		});

		it("should not mark declarations with unrelated comments as preserved", () => {
			const result = parseSourceFile(`
				/** Just a normal JSDoc comment */
				function documented() {}
			`);
			expect(result.preservedDeclarations).toEqual([]);
		});
	});
});
