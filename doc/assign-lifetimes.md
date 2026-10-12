# Assigning

When a storage unit needs to assume a value, we need to perform an assign. Assigning in frisk always means a bitwise copy from one place to another. However, sometimes, when assigning, we might end up with two bitwise duplicates of the same struct, which may end up with a broken state:

```frisk
let f = io.open("my-file.txt", "r");
let f2 = f; // if the compiler allowed it, we would have two copies of the same file

f.close();
f2.readall(); // bad stuff will happen here
```

Hence, frisk differenciates two types of assigning - copying and moving. Copying is the abovementioned duplication, while moving is an assign of A to B, where A will die after the assign. A move gives us nicer semantics, as the code will never observe a duplicate of the assigned value. Thus, we can perform bitwise copies where we previously couldn't. A good example for this is assigning the return value of `io.open` to a variable. This will be a move, as the return value has the lifetime of `temporary`, which, as described below, always constitutes in a move:

```
let f = io.open("my-file.txt", "r"); // Won't error out, even thou `file` has a `nocopy` field
```

# Lifetimes

Although intuitively we understand what a "lifetime" is, we need to concretize it.

Unlike rust, which tries to shrink a lifetime to the absolute minimum, so that more operations are permitted, frisk takes a more pragmatic approach. Lifetimes are expressed as a set of relative types of lifetimes:

- Temporary - the result of an evaluation, has an effective zero lifetime. Thus, it is always moved
- Local - its lifetime ends with its last use, so if its last use is as the source of an assign, a move will be performed
- Return - has a non-zero lifetime right after locals of an argument - passing a local to a return will always move, but passing an argument to a return will copy
- Argument - the union of the lifetime of a local and return (so basically lives before, during and after the call, effectively static)
- Static - same as argument, just a virtually bigger lifetie than an argument

A move requires that after the assign, the source dies

## `nocopy` type

The language provides a built-in type, which has the hardcoded property of being uncopyable. Since it is uncopyable, this of course means that structs that contain it by proxy become uncopyable too. This means that any struct that has a field of type `nocopy`, that the user tries to duplicate, will yield in a compiler error:

```frisk

struct my_funny_struct {
	nocopy;
	int a, b;
}

let a = my_funny_struct(10, 5);
let b = a; // error: assign results in a duplication, `my_funny_struct` is non-copyable
