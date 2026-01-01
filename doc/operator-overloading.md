# Operator overloading

This will be short. In this language, all arithmetic and binary operators relate to a single `op::*` call. For example, `a + b` can be equivalently written as `op::add(a, b)`.

Here's an example for overloading an arithmetic operator:

```c
struct int_wrapper {
	int val;
}

int_wrapper op::add(int_wrapper a, int_wrapper b) {
	return { .val = a.val + b.val };
}

void main() {
	int_wrapper res = { .val = 10 } + { .val = 5 };
}
```

## Comparasion operators

Comparasion operators are a bit more complex - they will use the generic `op::cmp` operator, which returns a value, which can then be tested with the `op::gr`, `op::greq`, `op::le`, `op::leq`, `op::eq` and `op::neq`. All 4 are required for an implementation, since sometimes, some values don't follow strict mathematical ordering rules.

`bool` delcares `op::eq` and `op::neq`, so an `op::cmp` may return a boolean, thus declaring the type it is declared for an equatable (but not comparable). `int` on the other hand declares the other relational compare ops, which work on `strcmp` logic (imagine the `int` is put on the left and `0` is put on the right of the requested comparison, so `op::leq` on an `int` would perform `val <= 0` logically). Furthermore, `op::cmp` for `int` is simply an alias for `op::sub`.

IF you try to use a `<` (or any other relational comparison operator), but the compare result type of `op::cmp` doesn't define the `op::le` method, the compiler will report a readable "type 'x' not comparable ('op::le' not defined for compare result 'y')".

## Performance

Most of these abstractions will be optimized away by most compilers, as most of these operator overloads will be marked as `inline`, and statically-linked in the same compilation unit as your code.

In future, our compiler will inline most of this as well, so that interpreted targets will not slow down due to these abstractions. For now, the compiler produces very naive, but predictable C code.
