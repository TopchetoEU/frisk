# Literals

A literal is a construct, which declares a hard-coded constant in frisk. There are 7 literal types:

- Integers
- Floats
- Characters
- Strings
- Tuples
- Struct type
- Function type

Each tuple will resolve to its respective type: `lit.int`, `lit.float`, `lit.char` and `lit.string`, and `type` for type literals. This means that declaring a literal like this:

```frisk
let one = 1;
```

Will make `one` of type `lit.int`. This is useful, but a lot of the times, not what you actually meant. It is recommended to specify the type of a declaration, when initializing with a literal.

## Tuples

Tuples are a very special literal. They are used to initialize structs, unions, and are also used as the syntax for call parameters. A tuple contains a list of:
- Named fields
- Unnamed fields, identified by types
- Array elements
- Spread elements

```frisk
let a = (.a = 10, .b = 5, .(int) = 10, 6, 7, ...(1, 2, 3));
```

Unlike all other literal types, tuples do not have a native type, and will error out if no target type is specified - tuples are a transient type. However, you can always just declare a struct, to which you can assign the tuple:

```frisk
let struct {
	int a;
	int b;
} my_tuple = (.a = 10, .b = 5);
```

Another added benefit is that if a struct has an unnamed field of an array type, a tuple will initialize that array with its array elements:

```frisk
let struct {
	unsigned size;
	int[size] arr;
} my_tuple = (1, 2, 3);

pprint(my_tuple); // outputs `(.size = 3, .arr = (1, 2, 3))`
```

The same syntax is used in calls as well, allowing to specify named parameters:

```frisk
let my_func(int a, int b) void {
	print(a, b);
}

my_func(.a = 10, .b = 5);
```
