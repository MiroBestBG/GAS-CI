#!/usr/bin/env bun

import cac from "cac";

console.clear();

const cli = cac("gas");

cli.help();
cli.version("0.0.1");
cli.parse();
