#!/usr/bin/env node
import { runCli } from './cli.js';

const projectRoot = process.cwd();

runCli(process.argv, projectRoot);
