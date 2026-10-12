# Frisk Execution and Name-Resolution Design

Frisk's main unit of code is a `chunk`. It is a list of statements, each statement may be a declaration, control-flow or an expression. The top-level of a file is a chunk, and each curly-braced body is a chunk. Each chunk has a namespace of its own, and by default, `outer` set to the parent chunk's namespace.

## Discovery, name binding and translation to CFG

The following steps get performed for each node, in order:
- If the node is a declaration, it is recorded in the namespace. For `=` declarations, the existing declaration is overwritten, for `+=` declarations, it is overloaded
- For all other nodes, all of its names get recursively resolved. If the name doesn't exist (yet), an error is reported. There are some exceptions to that rule, we'll get to that later
- The node is then translated into a CFG node, which is then connected into the current chunk's CFG

### Overloads vs overwrites

Frisk supports overloads - each declaration is simply a list of type-value pairs. The language only disallows two overloads of the same type, as there's no way to disambiguate that. An overload is picked based on the target type.

An overwrite on the other hand removes the declaration from the namespace and replaces it with another. This is also known as "shadowing". Note that the names that are bound to the shadowed declaration keep referencing the old declaration.

### Weak bindings

There is a special type in the language (`weakbind`), which, when cast to, directly interacts with this steps and allows a forward-reference:

```frisk
let weakbind = import("std/weakbind").weakbind;

let a = weakbind(my_decl);
print(a ?? 0); // 0
let int my_decl = 10;
print(a ?? 0); // 10
```

In the resolver, this simply means that the name gets recorded in a table of unresolved names, and the first declaration of that name that gets found after that is bound to the `weakbind`. In code, `weakbind` behaves like an option union type. `weakbind` is used in pointer types for example, so that we can have recursive pointers:

```frisk
let uptr(generic weakbind(type) T) type {
	struct uptr {
		T _dst_type;
	}

	// ...

	let uptr.dst_type(uptr self) type {
		return self._dst_type ?? throw("type not yet resolved");
	}

	return uptr;
}
```

```frisk
struct a {
	// `!` is an operator on types, a shorthand for `uptr(b)`. `*` is not possible as types are lexically expressions
	b! b_ptr;
}
struct b {
	a! a_ptr;
}
```

## Children chunk resolution

After our chunk is done resolving, all of its children will be resolved, inheriting the now complete parent chunk. This is done so that forward references are possible in cases where it makes sense:

```frisk
let my_func(int a) int {
	return a + MY_CONST;
}

let int MY_CONST = 10;
```

This order is only violated if a chunk is referenced in the same chunk its declared in:

```frisk
let my_func(int a) int {
	return a + MY_CONST;
}

print(my_func(5)); // Errors out, if print is here

let int MY_CONST = 10;

print(my_func(5)); // Runs just fine, as the namespace now contains `MY_CONST`
```

This also goes for control flow statements that have chunks, as their chunks, obviously, get referenced at the lexical point of the control flow statement.

## Specialization

Since specialization is an opaque language feature over which users have strict control, this is more of a language stage than an optimization. In this stage, functions with `generic` arguments will be specialized, and ones with `generic` return types will be inlined into the CFG.


## Passing chunks as values

In the language, chunks are just literals, like number, string and tuple literals. A chunk may be passed as a value (and the language provides a special-case, where you don't need parens for a single cunk argument). Chunks as values simply hold a reference to the chunk's entry CFG node, as well as its namespace:

```frisk
let eval = import("std/eval");

let chunk my_chunk = {
	print("Hello, world!");
};

// Casts of a chunk to a function are also possible:
let func(int a, int b) int = {
	return a + b;
};

// The above-mentioned call syntax

// `eval.chunk` is a helper type, which lets us just do `body.eval()`. It also exposes stuff like `contine`, `goto` and `return`. Since `body.eval` is generic, it will be inlined and the whole interpreter-optimized away
// `eval.res` on the other hand contains information for the callee of how to proceed. When an expression statemnt in a chunk is of this type, the resolver has a special case to handle this return type implicitly
let unless(generic bool cond) func(generic eval.chunk body) generic eval.res {
	// We can do this as a shorthand to the function literal, since its a chunk that is casted to a function
	return {
		if (!cond) return body.eval();
		else return eval.res.none;
	};
}
```

## Runtime and compile-time

Frisk doens't really have a compile-time. Actually, frisk, technically, is an interpreted language. However, the "compiler" takes your file, compiles it, takes the resultant chunk and translates all exported declarations to machine code. This means that the top-level of your files are interpreted by the compiler, while the `main` export will be run as machine-code. However, this distinction is made to be as transparent to the user code as possible - you should not care where your code runs. You should be able to run any function in the top level with the same success you would in the exported and translated functions:

```frisk

let my_func(a int, b int) int {
	print(a, b);
	return a + 5 * b;
}

// Evaluated in compile-time, prints while compiling
let val = my_func(10, 5);

export main() void {
	// Evaluated in the so-called runtime
	let val = my_func(10, 10);
	print(val);
}
```

## Runtime global variables

In C, you have global variables, which are ones in the top-level:

```c
int a = 10;

int main() {
	printf("%d", a);
	return 0;
}
```

In more or less the same way, frisk's top-level declarations act as global variables. Mutable top-level variables that are referenced by a serialized chunk will be allocated on the `data` sector and will be usable in runtime:

```frisk
var int a;

let my_func() void {
	print(a);
}

export main() void {
	a = 10;
	my_func();
	a = 5;
	my_func();
}
```

However, the initializers of declarations are run in lexial order, so the initializers of global variables are run in compile-time. This means that `let a = io.open("test.txt", "r");` won't mean what you probably meant.

The stdlibs provide you with the `noserialize` type, which may be put as an anonymous field in structs, to mark them as non-translatable by compilers.
