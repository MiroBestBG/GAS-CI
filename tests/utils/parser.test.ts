import { describe, expect, it } from "bun:test";
import { parseSourceFile } from "@/utils/parser";

describe("parseSourceFile()", () => {
	describe("should return empty metadata for an empty file", () => {
		const result = parseSourceFile("");
		expect(result).toEqual({
			functionNames: [],
			variableMatches: [],
			classNames: [],
			preservedFunctionNames: [],
			existingExports: [],
		});
	});

	describe("should ignore statements it doesn't handle (e.g. type aliases, interfaces)", () => {
		const result = parseSourceFile(`
			type Foo = string;
			interface Bar { x: number; }
		`);
		expect(result.functionNames).toEqual([]);
		expect(result.variableMatches).toEqual([]);
		expect(result.classNames).toEqual([]);
	});

	describe("function declarations", () => {
		it("should extract function declaration names", () => {
			const result = parseSourceFile(`
			function foo() {}
			function bar() {}
		`);
			expect(result.functionNames).toEqual(["foo", "bar"]);
		});

		it("should extract exported function declarations into both functionNames and existingExports", () => {
			const result = parseSourceFile(`export function greet() {}`);
			expect(result.functionNames).toContain("greet");
			expect(result.existingExports).toContain("greet");
		});

		it("should mark a function with @preserveName as preserved", () => {
			const result = parseSourceFile(`
			/** @preserveName */
			function keep() {}
		`);
			expect(result.functionNames).toContain("keep");
			expect(result.preservedFunctionNames).toContain("keep");
		});

		it("should mark a function with @public as preserved", () => {
			const result = parseSourceFile(`
			/** @public */
			function publicFn() {}
		`);
			expect(result.preservedFunctionNames).toContain("publicFn");
		});
	});
	describe("Class declarations", () => {
		it("should extract class declaration names", () => {
			const result = parseSourceFile(`class MyClass {}`);
			expect(result.classNames).toEqual(["MyClass"]);
		});

		it("should extract exported class declarations into both classNames and existingExports", () => {
			const result = parseSourceFile(`export class Service {}`);
			expect(result.classNames).toContain("Service");
			expect(result.existingExports).toContain("Service");
		});

		it("should mark a class with @preserveName as preserved", () => {
			const result = parseSourceFile(`
			/** @preserveName */
			class Important {}
		`);
			expect(result.classNames).toContain("Important");
			expect(result.preservedFunctionNames).toContain("Important");
		});
	});

	describe("variable statements", () => {
		it("should extract variable names into variableMatches", () => {
			const result = parseSourceFile(`const x = 1;`);
			expect(result.variableMatches).toContain("x");
			expect(result.functionNames).not.toContain("x");
		});

		it("should add arrow function variables to both variableMatches and functionNames", () => {
			const result = parseSourceFile(`const add = (a: number, b: number) => a + b;`);
			expect(result.variableMatches).toContain("add");
			expect(result.functionNames).toContain("add");
		});

		it("should add function expression variables to both variableMatches and functionNames", () => {
			const result = parseSourceFile(`const multiply = function(a: number, b: number) { return a * b; };`);
			expect(result.variableMatches).toContain("multiply");
			expect(result.functionNames).toContain("multiply");
		});

		it("should extract exported variable statements into existingExports", () => {
			const result = parseSourceFile(`export const API_KEY = "abc";`);
			expect(result.variableMatches).toContain("API_KEY");
			expect(result.existingExports).toContain("API_KEY");
		});

		it("should mark variables with @preserveName as preserved", () => {
			const result = parseSourceFile(`
			/** @preserveName */
			const handler = () => {};
		`);
			expect(result.preservedFunctionNames).toContain("handler");
		});

		it("should handle multiple declarations in a single variable statement", () => {
			const result = parseSourceFile(`const a = 1, b = () => {}, c = "hello";`);
			expect(result.variableMatches).toEqual(["a", "b", "c"]);
			expect(result.functionNames).toEqual(["b"]);
		});

		it("should skip destructured variable names", () => {
			const result = parseSourceFile(`const { a, b } = obj;`);
			// Destructuring patterns are not ts.isIdentifier on decl.name, so they're skipped
			expect(result.variableMatches).toEqual([]);
		});
	});

	describe("named export declarations", () => {
		it("should extract names from named export declarations", () => {
			const result = parseSourceFile(`
			function foo() {}
			const bar = 1;
			export { foo, bar };
		`);
			expect(result.existingExports).toContain("foo");
			expect(result.existingExports).toContain("bar");
		});
	});

	describe("deduplication", () => {
		it("should deduplicate when a function is both export-keyword and export-declaration exported", () => {
			const result = parseSourceFile(`
			export function dupe() {}
			export { dupe };
		`);
			const dupeCount = result.existingExports.filter((n) => n === "dupe").length;
			expect(dupeCount).toBe(1);
		});
	});

	describe("No comments", () => {
		it("should not mark declarations without comments as preserved", () => {
			const result = parseSourceFile(`
			function plain() {}
			class Plain {}
			const v = 1;
		`);
			expect(result.preservedFunctionNames).toEqual([]);
		});

		it("should not mark declarations with unrelated comments as preserved", () => {
			const result = parseSourceFile(`
			/** Just a normal JSDoc comment */
			function documented() {}
		`);
			expect(result.preservedFunctionNames).toEqual([]);
		});
	});
});
