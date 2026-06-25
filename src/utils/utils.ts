export async function outputAndExit(message: string, error?: unknown) {
	console.error(message);
	if (error) console.error(error);
	process.exit(1);
}
