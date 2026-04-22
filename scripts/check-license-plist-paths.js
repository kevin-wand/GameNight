#!/usr/bin/env node
/**
 * Ensures every `file:` path in ios/license_plist.yml points at an existing file
 * (relative to ios/). Run after npm install; fails if LicensePlist would hit a missing LICENSE.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const iosDir = path.join(root, "ios");
const ymlPath = path.join(iosDir, "license_plist.yml");

const text = fs.readFileSync(ymlPath, "utf8");
const re = /^\s*file:\s*'(\.\.\/node_modules\/[^']+)'/gm;
const missing = [];
let m;
while ((m = re.exec(text)) !== null) {
  const rel = m[1];
  const abs = path.normalize(path.join(iosDir, rel));
  if (!fs.existsSync(abs)) {
    missing.push(rel);
  }
}

if (missing.length) {
  console.error(`check-license-plist-paths: ${missing.length} missing file(s):`);
  for (const rel of missing) console.error(`  ${rel}`);
  process.exit(1);
}

console.log("check-license-plist-paths: all file: paths exist.");
process.exit(0);
