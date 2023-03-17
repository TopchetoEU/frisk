# Copying and moving

In ++C, there are concepts of moving and copying value. Such concepts exist in all major low-level languages, like C++ and Rust. These concepts are utilized to more efficiently manage values.

## Why do we need copying and moving

In a low-level language, like C, when we use the assignment operator, with a value, we perform a copy of the underlying object. However, if the object is managing underlying resources, copying the object bitwise into the variable will result in eventual corruptions, and in general, is not a great idea. In such cases, we need to specify custom copying and moving code.

## Moving

Moving is NOT the default behavior. It is the most efficient way to perform assignments. Moving will copy the object bitwise, but will invalidate the previous owner of the object, hence "moving" the object to the designated place. The only case when moving is the default behavior is with return values. Here's an example of a move:

```ts
var a: string = "test";
var b = move a;
```

In this case, we moved `a` into `b`, and if we use `a`, the compiler will tell us that `a` was moved:

```ts
var a: string = "test";
var b = move a;
printf("%s", a); // Error: a was invalidated by a move at ...
```

## Temp-moving and `move` parameters

Temp-moving is like moving, but doesn't invalidate the source object. Temp moving will be performed only for `move` parameters, and when passing to a `move` parameter. This is primarily used in custom operators. `move` parameters are parameters, that cannot be moved, only copied. You can't assign to a `move` parameter. Here's an example of temp-moving and a `move` parameter:

```c++
struct MyInt {
    val: int;

    constructor(val: int) {
        this->val = val;
    }
}

___add(move a: MyInt, move b: MyInt) {
    return MyInt(a.val + b.val);
}

export main() {
    var a = MyInt(10);
    var b = MyInt(5);
    var c = a + b;
}
```

However, we may not do the following:

```c++
___add(move a: MyInt, move b: MyInt) {
    a = b; // error: can't assign to a move parameter
    var c = move a; // error: can't move a move parameter
    a.val = 5; // error: can't modify a move parameter
}
```

## Copying

Copying is the default behavior for assignments, and is an alternative to moving. A copy of the object is guaranteed to behave in the same way as the copied object, self-explanatory. However, copying can be in some cases wasteful, and unnececeary. Unlike move semantics, an object may define custom copy semantics. Here's an example:

```cpp
export struct test_t {
    export a: int;
    export b: int;

    export constructor(a: int, b: int) {
        this.a = a;
        this.b = b;
    }

    export copyof(): test_t {
        return new test_t(this.a, this.b);
    }
}
```

Then, we can use it to copy the user like this:

```ts
export main() {
    var a: string = "test";
    var b = copyof a;
    printf("%s", b); // Prints normally, no errors
}
```

## Disabling copy semantics for object

Each structure defines a default `copyof` operator. However, you may want to remove the ability to copy the object. This is done by making a `copyof` operator, that returns `void`. A `copyof: void` operator may not have a body. Here's an example:

```cpp
struct Test {
    export copyof(): void;
}

export main() {
    var test = Test();
    var test2 = copyof test; // error: Test may not be copied.
}
```

Since the `copyof` operator returns void, it will be invalidated. If you now use this type as a field in another type, the other type's copy operator will be invalidated, too:

```cpp
struct Test2 {
    test: Test;
}

export main() {
    var test = Test2();
    var test2 = copyof test; // error: Test2 may not be copied.
}
```
