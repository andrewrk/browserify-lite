var fs = require('fs');
var browserifyLite = require('./');

var entrySourcePath = process.argv[2];
var outputFileParam = process.argv[3];
var outBundlePath = process.argv[4];

if (outputFileParam !== '--outfile') {
  console.error("Expected second param to be --outfile");
  process.exit(1);
}

if (!outBundlePath || !entrySourcePath) {
  console.error("Expected first arg to be source path and third arg to be out bundle path.");
  process.exit(1);
}

browserifyLite.createBundle(entrySourcePath, outBundlePath, function(err) {
  if (err) throw err;
});
