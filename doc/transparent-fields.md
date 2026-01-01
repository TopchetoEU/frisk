# Transparent fields

This language has a concept of 'transparent' fields. Such fields do not define a name, and are only referred by their type. Both structs and unions may have such fields. They are called 'transparent', because the struct/union can be transparently converted to one of its transparent field's types. For example:

```c
struct my_struct {
	int;
	float;
}

void main() {
	my_struct test = { .(int) = 10, .(float) = 5.5 };
	int a = test; // equivalent to test.(int)
	float b = test; // equivalent to test.(float)
}
```

In this case, when `test` was passed to `a`, the `(int)` field got automatically picked, while for `b`, `(float)` got picked instead.

## Explicit syntax

As you saw above, transparent fields are accessed with a very similar way to regular fields, but the type name, following the `.` is put in parens. Although you could use a cast instead to hint the compiler to extract the required field, it is reccomended you use the `.(type)` when possible, as it is much more explicit in its intent.

## Unions

In unions, provided the field's existence is proven, you can do the same:

```c
union my_union {
	int;
	float;
}


void main() {
	my_union test = (int)10; // or { .(int) = 10 }

	if (test is .(int)) { // special operator to prove unions
		// as at most one field of a union is gettable at a time, for this code path, `test` has a "honorary" type of `int`
		print("{} is int", test);
	}
	else if (test is .(float)) {
		print("{} is float", test);
	}
	else {
		// compiler will warn for unreachable, as union has been exhausted
		print("unreachable!!");
	}
}
```


