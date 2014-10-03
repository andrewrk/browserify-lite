# browserify-lite

browserify, minus some of the advanced features and heavy dependencies.

 * No builtin Node.js shims.
 * Naive regex search for require instead of true AST parsing.
   - Require statements must be outside all braces. This includes functions,
     control statements, and objects.
 * Only supports a single entry file and the `--outfile` parameter,
   nothing else.
 * No dependencies.
