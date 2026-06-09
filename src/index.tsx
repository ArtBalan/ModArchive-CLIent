#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './App';
import * as path from 'path';

const dbPath = process.argv[2] ?? path.join(process.cwd(), 'scraper.db');

render(React.createElement(App, { dbPath }), {
  exitOnCtrlC: true,
});
