import ts from "typescript";

export interface FileMetadata {
	functionNames: string[];
	variableMatches: string[];
	classNames: string[];
	preservedFunctionNames: string[];
	existingExports: string[];
}

export function parseSourceFile(content: string): FileMetadata {
	const sourceFile = ts.createSourceFile("temp.ts", content, ts.ScriptTarget.Latest, true);
	const functionNames = new Set<string>();
	const variableMatches = new Set<string>();
	const classNames = new Set<string>();
	const preservedFunctionNames = new Set<string>();
	const existingExports = new Set<string>();

	for (const statement of sourceFile.statements) {
		if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
			for (const element of statement.exportClause.elements) {
				existingExports.add(element.name.text);
			}
			continue;
		}

		const exported = isExported(statement);
		const preserved = hasPreserveTag(statement, sourceFile);

		if (ts.isFunctionDeclaration(statement) && statement.name) {
			const name = statement.name.text;
			functionNames.add(name);
			if (preserved) preservedFunctionNames.add(name);
			if (exported) existingExports.add(name);
		} else if (ts.isClassDeclaration(statement) && statement.name) {
			const name = statement.name.text;
			classNames.add(name);
			if (preserved) preservedFunctionNames.add(name);
			if (exported) existingExports.add(name);
		} else if (ts.isVariableStatement(statement)) {
			for (const decl of statement.declarationList.declarations) {
				if (!ts.isIdentifier(decl.name)) continue;
				const name = decl.name.text;
				variableMatches.add(name);

				if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
					functionNames.add(name);
				}
				if (preserved) preservedFunctionNames.add(name);
				if (exported) existingExports.add(name);
			}
		}
	}

	return {
		functionNames: [...functionNames],
		variableMatches: [...variableMatches],
		classNames: [...classNames],
		preservedFunctionNames: [...preservedFunctionNames],
		existingExports: [...existingExports],
	};
}

function isExported(node: ts.Node): boolean {
	return (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
}

function hasPreserveTag(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	const fullText = sourceFile.getFullText();
	const comments = ts.getLeadingCommentRanges(fullText, node.pos);
	if (!comments) return false;
	return comments.some((c) => /@preserveName|@public/.test(fullText.substring(c.pos, c.end)));
}
