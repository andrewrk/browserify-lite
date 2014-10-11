#!/usr/bin/env node

var fs = require('fs');
var browserifyLite = require('./');

var entrySourcePath = process.argv[2];
var outputFileParam = process.argv[3];
var outBundlePath = process.argv[4];

if (entrySourcePath === '--help') {
  usage();
}

if (outputFileParam !== '--outfile') {
  console.error("Expected second param to be --outfile\n");
  usage();
}

if (!outBundlePath || !entrySourcePath) {
  console.error("Expected first arg to be source path and third arg to be out bundle path.\n");
  usage();
}

browserifyLite.createBundle(entrySourcePath, outBundlePath, function(err) {
  if (err) throw err;
});


function usage() {
  console.error(
      "Usage: browserify-lite ./entry-file.js --outfile bundle.js\n" +
      "\n" +
      "Standard Options:\n" +
      "\n" +
      "        --outfile  Write the browserify bundle to this file.");
  process.exit(1);
}
