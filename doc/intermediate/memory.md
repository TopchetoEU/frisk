# Memory in PPCIL

In ++C, memory is addressed linearly (unlike x86 systems). The whole memory is a heap, but a part of it is storage for a stack.

## The heap

The heap is of any arbitrary size = N (defined by the underlying interpreter), and the first N bytes after 16 bytes are accessible to the executed PPCIL code. If an attempt is made to dereference a pointer outside the heap, an interrupt `HEAPFAULT` is going to be thrown (read more about `HEAPFAULT` here [interrupts](./interrupts.md)). The first 16 bytes are reserved for the interpreter.

## The stack

The stack is a part of the heap. It (like x86), is not of a particular size, and goes backwards (a pushed value goes before the previously pushed values). A stack's size is determined by the initial value, given to the stack pointer gy the interpreter. The stack's memory is still accessible via heap operations, but there are special operations that are designed to work with the stack. As well as that, if a stack operation is trying to write beyond the stack's limit, a `STACKFAULT` is going to be thrown instead.

## Memory virtualization

Some interpreters support a special set of instructions ([instructions](./instructions.md)), which are used to make a special kind of call in a separate memory space, basically emulating an interpreter within the interpreter, but without the cost of two-level interpretation.