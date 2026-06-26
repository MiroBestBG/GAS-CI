#!/usr/bin/env bun

import cac from "cac";
import { init } from "@/commands/init";
import { push } from "@/commands/push";

console.clear();

const cli = cac("gas");

cli.command("init [projectName] [scriptId]", "Initialize a new GAS project").option("-f, --force", "Remove the project directory if it already exists").action(init);
cli.command("push", "Push local changes to Google Apps Script").option("-w, --watch", "Watch for changes and push automatically").action(push);

cli.help();
cli.version("0.0.1");
cli.parse();
