# Modules

A module in frisk is a single file, imported via `import(string name)`. Where such a file comes from is an impl detail, but the convention is that "name" is resolved by replacing the dots in the name with slashes and resolving in respect to the root module, as well as some system-defined absolute locations (more or less lua's algorithm).

Each module, alongside its chunk namespace, has an export namespace, completely othogonal to the internal namespace. A module puts declaration into the export namespace by using the `export` statement:

```frisk
// test1.fr
export my_decl = 10;

// test2.fr
let test1 = import("test1");

print(test1.my_decl); // 10
```

## Main module

The main module is the module which is being "compiled". If it is an executable, it must by convention export a `main` declaration of type `func () void`. It will be called when the application is run. For library compilation, the list of all exports will be taken and serialized to a single native library instead.

## Synthetic imports

Since importing is implementation-defined, we may have different sources of imports. The biggest case for this are synthetic imports, which generate FFI wrapper modules, which interact with other languages:

```frisk
let lua = import("ffi.lua");
let python = import("ffi.python");
let c = import("ffi.c");

let lpeg = lua.require("lpeg");
let pandas = python.import("pandas");
let cstring = c.include("string.h");
```

Those imports will take the other language, import it, and generate a namespace which we can consume. For dynamic languages, a dynamic object is returned instead, which has runtime semantics - member access and method calls will be dispatched dynamically, using user code, but most importantly, will be unchecked in compile-time.
