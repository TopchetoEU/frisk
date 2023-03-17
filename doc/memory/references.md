# Unmanaged (or real or C) pointers

Such pointers act like C's pointers. Arithmetic operations can be applied upon them, only unmanaged pointers may be NULL, and they always define copy semantics. The compiler performs no checks for memory safety for such pointers.

# Heap (or value or owner) pointers

Such pointers are generally on the heap. Heap pointers are acquired via the `new` operator, and act like a "wrapper" for the value. Heap pointers use the `^` character, instead of the `*` character. Heap pointers have the following:
- Destructor - frees all resources from the underlying object, and then frees the memory
- Copy operator - allocates enough space for the underlying object, and uses the underlying object's copy semantics. If the underlying object is not copyable, the pointer doesn't define copy operators, too.

Here's an example:

```cpp
export create_hello_world(): string^ {
    return new string("Hello, world");
}
```

# Stack (or borrowed or user) pointers

Stack pointers may be used anywhere you'd see a normal pointer. However, the main difference is that stack pointers are being checked for lifetime - an object may borrow a stack pointer, only if the required lifetime is met. Borrowed pointers are written with the `&` character, instead of the `*` character:

```cpp
export func(myptr: int&) {
    // ...
}
```

A stack pointer has special move semantics - the compiler will check if we're moving a stack pointer into a stack pointer with a smaller lifetime.

## Lifetime of a stack pointer

The lifetime is an abstract, relative measure of time, that will roughly tell us for how long an object will live. Normally, the lifetime of an object is from its creation to the end of the scope.

Each stack pointer has a specific lifetime. Of course, the lifetime of the pointer is different from the lifetime of the variable the pointer is kept in (usually longer). The lifetime of a pointer doesn't necessarily reflect the underlying object's lifetime, but specifies the minimal required lifetime of the object pointed to. Depending on the location of the stack pointer, it will have a different base lifetime:
- Local variables - the lifetime of the enclosing scope
- Parameters - the lifetime of the function
- Fields - the lifetime of the object
- Global variables - the lifetime of the app (static lifetime, infinite lifetime)
- Return type - the lifetime is zero

## Lifetime specifiers (custom pointer lifetime)

Sometimes, we might want to extend a pointer's lifetime, for example, for a return value. This is why we have lifetime specifiers. They will specify for how long a pointer will live, past their base lifetime. This is done by copying other lifetimes. The following lifetimes may be copied:
- The current function's scope (via the keyword `function`)
- The current scope (by specifying the name of another variable, valid only in statements)
- The current object (by using `*this`, valid only for fields and member functions)
- Any stack pointer (by using `*name`)
Any other expression will result in an error. There may be multiple lifetime specifiers, separated by commas. The resultant lifetime is the union of the base lifetime with the intersection of all the lifetime specifiers.

### Examples

```cpp
export forward(a: string&): string&(*a) {
    return a;
}
```

In this case, if the caller passes a string for `a`, it will expect the return value to have the exact same lifetime, which will exceed 

```cpp
export max(a: string&, b: string&): string&(*a, *b) {
    if (*a > *b) return a;
    else return b;
}
```

In this function, we have two lifetime specifiers, and the compiler will pick the smallest of them. If we call the `max` function like this:

```cpp
var a: string = "abc";
var b: string = "xyz";
var res = max(&a, &b);
printf("%s", *res);
```

The result would be `"xyz"`, and `res` would have a lifetime of `a`'s scope. However, if we called the function like this:

```cpp
var a: string = "abc";
var res: string&;
{
    var b: string = "xyz";
    res = max(&a, &b); // error: Tried to move a stack pointer with a shorter lifetime than expected
}
printf("%s", *res);
```

The compiler will throw an error, since `max` will return a pointer with the lifetime of `b`, since it's smaller than `a`'s lifetime. Therefore, we'd be trying to assign a stack pointer with a smaller lifetime to a variable with a longer lifetime.
