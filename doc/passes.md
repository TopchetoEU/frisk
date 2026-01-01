# Compiler stages

1. First walk - parses file, walks all declaration and exports, records them in a symbol table, walks all imports and does the same for them
2. Second walk - after all symbol tables have been resolved, resolves import symbols and export aliases
3. Resolution - all generated symbol tables get walked, and all references to types / symbols get resolved. The AST gets converted to a CFG of calls and assignments  The symbol tables get "linked", the old ASTs get converted into a resolved IR AST. We start walking all exported functions and resolving their calls & types. Here, colliding overloads get checked, types get resolved & checked. Unreachable functions are not walked BY DESIGN. The user will be warned about unreachable functions
3. Translation - The export symbol table of the main module gets traversed, with the dependencies of each export being walked as well. All functions/types, necessary for the compilation get emitted to the target language - be that assembly, object file, LLVM IR, or for now, C

# Parsing stages

- Tokenization - A source is taken as a stream of characters and converted to an array of tokens. A single pass tokenizer is used, for simplicity's sake
- Parsing - The token array is taken and converted to an array of declarations, exports and imports. A recursive descent parser is used for simplicity's sake

# Error reporting

When a critical error occurs, we stop the compilation. This isn't a best-effort compiler (for now), but a "yer or no" compiler. We make no effort to continue after an error. This significantly reduces the complexity of the MVP.

Warnings are just printed as stderr logs, again, for simplicity's sake.
