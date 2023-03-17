# Unions

++C has a special type, called a "union". The union combines multiple types into one. The union may be only one of these types at a time.

## Syntax

The syntax of a union is similar to Typescript's union syntax:

```ts
type1 | type2 | type3 ... | typen
```

## Transparent field access

The language will allow you to access common fields of the union, for example:

```ts
struct A {
    val: int;
    constructor(val: int) => this->val = val;
}
struct B {
    val: int;
    constructor(val: int) => this->val = val;
}

var myunion: A | B = A(5);

printf("%d", myunion.val); // 5
```

In the future, compilers might implement support for passing unions to arguments that accept one of the unioned types. However, due to the complexity of the feature, it is left up to the implementation wether or not to implement this feature.


## Runtime type checking

++C unions enable you to check what type is the underlying value. This is done via the `is` operator:

```ts
var a: int | bool = 10;

if (a is int) printf("int");
else if (a is bool) printf("bool");
```

If the compiler determines that, at the current point of the code, some of the types in the union have been eliminated, the compiler will act as if the union is made up of the remaining types. Example:

```ts
struct A {
    a: int;
    constructor(a: int) => this->a = a;
}
struct B {
    b: int;
    constructor(a: int) => this->b = a;
}
struct C {
    c: int;
    constructor(c: int) => this->c = a;
}
struct D {
    c: int;
    constructor(c: int) => this->c = a;
}
var a: A | B | C | D = ...;

if (a is C | D) printf("%d", a.c);
else if (a is B) {
    if (a is D) printf("Impossible"); // warning: unreachable code detected (B can't be D)
}
```

## Optional union

The optional union is a union, that contains `void` in its list. Optional unions can be written with a question mark, suffixed to the type, as well:

```ts
int?
```

Otherwise, the union can be used as normal.

## Any union

The any union is a combination of all types. It is assumed that the intersection of all types is `void`, hence 