#!/usr/bin/env bun

import cac from "cac";
import { init } from "@/commands/init";

console.clear();

const cli = cac("gas");

cli.command("init [projectName] [scriptId]", "Initialize a new GAS project").action(init);

cli.help();
cli.version("0.0.1");
cli.parse();
