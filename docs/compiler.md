# The compiler

In this project, the compiler has a broad meaning, and it ecapsulates the process of creating a binary file from a source file. Although in many cases the binary file might be understood as a source file, for example, the compiler might compile to Javscript, or might compile from x86 assembly, the input of the compiler is called "sources" and the output is called "binaries".

The compiler's ideology is to be modular, so that anyone can come along and add functionality to it, without too much fuss. For that purpose, the compiler has three modular parts, that can be replaced at the user's discression:

- Parsing (Converting sources to an abstract syntax tree)
- Transforming (Simplifying and resolving the AST to a graph that can be compiled)
- Building (Converting the generated graph to the target binary)

## Parsing

In this stage of the compilation, the source code will be converted to a syntax tree. This stage might combine multiple stages (prerpocessing, tokenizing and tree building), although the default AST builder has just one stage. At this stage, only syntax errors should be reported, and no semantical analysis should be performed, as this is the job of the next stage. This stage operates on a per-file basis.

## The AST

The abstract syntax tree represents the result of the parsing. It closely mirrors the source code, and in most cases, is a lossless representation of the source code. The AST is used, because a linear stream of bytes is harder to work with than a tree.

Each node from the AST has a type, by which it is identified, and a location in the source, a string, following the format of "${filename}:${line}:${column}". Additionally, each node supports iterating over its children, used in the transforming stage.

## Transforming

In the transforming stage, the AST will be simplified and resolved. This is done by splitting the transforming stage into two repeating stages:
- Resolution
- Simplification

After the transforming is done, a modified AST will be returned, which will be usable in the next stage. The modified AST will contain well-understood node types, which the building stage will be able to understand:
- Fields, with a bit size and an optional default value as an expression tree
- Functions, with a set of arguments and their bit sizes, the size of the return value and the body
- Entrypoints - a function body for each entrypoint type

Function bodies are represented as a control flow graph, where each node is one of the following:
- Block node - includes an array of expression trees, which will be sequentially evaluated. Has one branch
- Return node - includes an expression tree, which will evaluate to determine the return value, and doesn't have branches
- Conditional branch statement - contains a condition and two branches - one for a zero value and another for a non-zero value of the expression

Expression trees consist of the following types of nodes:
- Call node - includes a reference to a function as well as an array of arguments (expression nodes), that will be passed to the function
- Local variable read
- Local variable write
- Raw expression - specifies a piece of raw binary to include as an expression

A type consists of 

## Optimizing

This is the stage at which the suboptimal resolved AST is taken and optimized, using more or less the same mechanics as the transforming stage. The only difference is that because the format of the resolved AST is known 