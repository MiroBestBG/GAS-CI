export function outputAndExit(message: string, error?: unknown): never {
	console.error(message);
	if (error) console.error(error);
	process.exit(1);
}
