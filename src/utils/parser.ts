import ts from "typescript";

export interface FileMetadata {
	unexportedDeclarations: string[];
	preservedDeclarations: string[];
}

export function parseSourceFile(content: string): FileMetadata {
	const sourceFile = ts.createSourceFile("temp.ts", content, ts.ScriptTarget.Latest, true);
	const unexportedDeclarations = new Set<string>();
	const preservedDeclarations = new Set<string>();

	for (const statement of sourceFile.statements) {
		const names = getDeclarationNames(statement);
		if (names.length === 0) continue;

		const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
		const preserved = hasPreserveTag(statement, sourceFile);

		for (const name of names) {
			if (!exported) unexportedDeclarations.add(name);
			if (preserved) preservedDeclarations.add(name);
		}
	}

	return {
		unexportedDeclarations: [...unexportedDeclarations],
		preservedDeclarations: [...preservedDeclarations],
	};
}

function getDeclarationNames(statement: ts.Statement): string[] {
	if (ts.isFunctionDeclaration(statement) && statement.name) return [statement.name.text];
	if (ts.isClassDeclaration(statement) && statement.name) return [statement.name.text];
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations.filter((d) => ts.isIdentifier(d.name)).map((d) => (d.name as ts.Identifier).text);
	}
	return [];
}

function hasPreserveTag(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	const fullText = sourceFile.getFullText();
	const comments = ts.getLeadingCommentRanges(fullText, node.pos);
	if (!comments) return false;
	return comments.some((c) => /@preserveName|@public/.test(fullText.substring(c.pos, c.end)));
}
