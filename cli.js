#!/usr/bin/env node

var fs = require('fs');
var browserifyLite = require('./');

var options = {};
for (var i = 2; i < process.argv.length; i += 1) {
  var arg = process.argv[i];
  if (arg === '--help') {
    usage();
  } else if (arg === '--outfile') {
    if (++i >= process.argv.length) usage();
    options.outBundlePath = process.argv[i];
  } else if (arg === '--standalone') {
    if (++i >= process.argv.length) usage();
    options.standalone = process.argv[i];
  } else if (!options.entrySourcePath) {
    options.entrySourcePath = arg;
  } else {
    usage();
  }
}

if (!options.outBundlePath || !options.entrySourcePath) {
  usage();
}

browserifyLite.createBundle(options, function(err) {
  if (err) throw err;
});


function usage() {
  console.error(
      "Usage: browserify-lite ./entry-file.js --outfile bundle.js\n" +
      "\n" +
      "Standard Options:\n" +
      "\n" +
      "        --outfile         Write the browserify bundle to this file\n" +
      "        --standalone xyz  Export as window.xyz");
  process.exit(1);
}
