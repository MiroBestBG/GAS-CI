# GAS CI

GAS CI is a CLI tool for building and deploying Google Apps Script (GAS) projects with modern JavaScript/TypeScript tooling. It acts as a wrapper around `clasp`, adding support for bundling, obfuscation, and automatic preservation of GAS entry-point functions.

This is the second version of GAS-CI. Previous iteration: [GAS-CD](https://github.com/MiroBestBG/GAS-CD).

## Features

- **TypeScript Support**: Write your GAS projects in modern TypeScript.
- **Bundling**: Automatically bundles your source files into a single script suitable for GAS.
- **Obfuscation**: Built-in support for code obfuscation using `javascript-obfuscator`.
- **Smart Exports**: Automatically preserves top-level functions, classes, and variables tagged with `@public` or `@preserveName` JSDoc comments so they remain accessible to the GAS environment (e.g., for triggers or UI calls) even after bundling and obfuscation.
- **Watch Mode**: Automatically re-bundle and push on file changes.

## Prerequisites

- [Bun](https://bun.sh/) installed.
- [Clasp](https://github.com/google/clasp) installed and authenticated (`clasp login`).

## Usage

You can run the CLI via Bun:

```bash
bun run index.ts
```

Alternatively, link it globally or compile it to an executable.

### Commands

#### `init`

Initializes a new GAS project using a built-in template.

```bash
gas init <projectName> [scriptId] [options]
```

- `<projectName>`: Name of the folder to create.
- `[scriptId]`: Optional Google Apps Script ID to clone an existing project.
- `-f, --force`: Remove the project directory if it already exists.

#### `push`

Bundles, obfuscates, and pushes local changes to Google Apps Script.

```bash
gas push [options]
```

- `-w, --watch`: Watch for changes in the `src` directory and push automatically.

## Project Structure

A typical initialized project looks like this:

```text
my-project/
├── .clasp.json       # Clasp configuration
├── appsscript.json   # GAS manifest
├── config.ts         # GAS CI configuration (obfuscation settings, etc.)
├── package.json
├── tsconfig.json
└── src/              # Your TypeScript source files
    └── _entrypoint.ts
```

## Preserving Functions for GAS

Google Apps Script requires certain functions (like `onEdit`, `doGet`, or functions called from the UI) to be globally accessible. Bundlers and obfuscators often mangle or hide these names.

To ensure a function remains accessible in GAS, simply add a `@public` or `@preserveName` JSDoc tag above it:

```typescript
/**
 * @public
 */
function onOpen() {
  // This function name will be preserved and accessible in GAS
}
```

## Configuration (`config.ts`)

The `config.ts` file in your project root controls the obfuscator settings:

```typescript
import { ObfuscatorOptions } from "javascript-obfuscator";

export type ConfigSchema = {
	obfuscate: {
		enabled: boolean;
		options: ObfuscatorOptions;
	};
};

export interface ConfigFile {
	config: () => Promise<ConfigSchema>;
}

export function config(): ConfigSchema {
	return {
		obfuscate: {
			enabled: true,
			options: {
                // ... obfuscator options
			}
		}
	};
}
```
