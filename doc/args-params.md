# Arguments and parameters

Most languages do parameter passing by copying the argument value and assigning it to a virtual local in the called function. For small types and pointers this is OK, but for all other types, this proves to be rather cumbersome - we either need to pass it by pointer, or bare the cost of copying the argument.

In frisk, there are three ways of passing a parameter:

- (default) - by a const reference (like C++'s const&). The callee only gets an immutable view of the argument, so it is never copied. The caller also gets a guarantee the argument is never mutated
- `ref` - by a mutable reference (like C++'s &). The callee gets a mutable view of the argument, so it may mutate it. Assigning to the parameter modifies the argument
- `own` - by a copy (like C's parameters). The parameter in the callee acts as a local variable, but a copy is required in this case

## Why avoid copies?

In a lot of cases, the programmer of a structure wants to ensure only one copy ever exists of it. A common pattern is to have an unnamed field of type `nocopy`, which makes your struct uncopyable.

In this case, having reference passing as the default makes such an architecture trivial:

```frisk

let c = import("ffi.c");
let unistd = c.include("<unistd.h>");
let fcntl = c.include("<fcntl.h>");
let errno = c.include("<errno.h>");

struct file {
	nocopy;
	int fd;
}

// self is passed by reference, so no copy is made, so `nocopy` is never violated
let file.read(file self, unsigned cnt) u8[] {
	let u8[cnt] buff;
	if (unistd.read(cnt, buff) < 0) {
		throw(errno.errno);
	}

	return buff;
}
let file.write(file self, u8[] buff) unsigned {
	let cnt = unistd.write(buff.size, buff);
	if (cnt < 0) {
		throw(errno.errno);
	}

	return cnt;
}

let file.open(string path) file {
	let int fd = fcntl.open(path, ...);
	if (fd < 0) {
		throw(errno.errno);
	}
	// returning performs a move, not a copy, so `nocopy` is not violated
	return (.fd = fd);
}

let f = file.open("my-file.txt");
print(string(f.read(1024)));
```
