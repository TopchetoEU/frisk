# ++C Intermediate Lang (PPCIL 1.0)

**NOTE: this currently is unused**

This is a read-only binary format, used in the ++C ecosystem to represent executable code. It has an assembly-like structure (opcode, followed by operands), so that a translation to a native instruction set can be more robust. Still, this IL's instruction set implements instructions, not found in some instruction sets. The idea behind that decision is to use native optimizations where possible (for example, using the square root instruction of the x86_64 instruction set, instead of a common algorithm for all instruction sets). One important thing to note is that PPCIL is not just an itermediate for ++C. A compiler could be written that converts any language to PPCIL, for example: Java, C#, C++, C, etc. 

## Format

The format of a PPCIL blob is the following:

```c
struct ppcil_t {
    version_t version;
    uint64_t size;
    uint64_t int_callback;
    uint8_t data[size - 8];
}
```

### Version section

The first thing in a PPCIL blob is the version. The version format is identical with [the one](./versions.md) used ++C ecosystem. It is the first 64-bits in a PPCIL blob. It is used to specify the PPCIL format version used in the blob. An interpreter with an incompatible version can try to interpret the given PPCIL, but should give a warning if it will do so.

### Interrupt callback

This is a pointer to a function, that is going to get called upon any `INT` calls. If this is set to NULL or out of bounds of the blob, the parent's interrupt callback is going to be called, and so on, until the top level is reached. Then, it is implementation-specific what will happen (undefinedish behavior).

### Data section

This section contains arbitrary data, that is going to be executed. Execution starts from the 16th byte (due to first 16 bytes being inaccessible). This whole region is for the program to use, and has read/write access.

## Virtualization

PPCIL supports virtualization, via the special instructions `VCALL`

## The stack and the heap

The memory layout of a PPCIL interpreter is the usual stack/heap layout, with the only difference that the stack is a part of the heap, so addresses from the stack can be obtained, like in the heap (if you work with the stack via pointers, all stack guarantees are overriden).

The stack contains the variables and any temporary calculation data. The heap contains all the constants, static variables and dynamically allocated memory.

## Variables and parameters

The variables are contained on the stack and are used to contain temporary data druing the execution of the program. Parameters are the first n variables, that are automatically created and initialized with values by the interpreter. The parameters are passed by the caller of the piece of code. The parameters are the first n variables (where n is the amount of parameters that the function accepts). In some cases, the first variable (parameter) is the `this` context.

## Instructions set

The instructions in PPCIL are as versatile as possible, to allow maximum speed where these instructions have a native equivalent, instead of relying on idiom recognition.

**NOTE:** the operand notation is as follows: `size(name)`, so a 64-bit operand named count would be notated as follows: `8(count)`

**NOTE 2:** all `1(size)` operands are in the range 0-64, and is an exponential scale for the size of the values, taken from stack/heap by the instruction. For example, if size is 4, it will take 32-byte operands (2^4). If size is 16, it will take 2^16 (or 65 536) byte operands

### NOPs

This is a list of all opcodes that are reserved for NOP opcodes

0x00 - For zeroed out memory
0x90 - Intel x86 NOOP code
0xBA, 0xAD, 0xF0, 0x0D - For the idiom `0xBAADF00D`

### Stack operations

| Name  | Opcode | Operands | Description
|-------|--------|----------|-------------
| PADR  | 0x01   | 8(n)     | Pushes n zeroes to the stack
| PAD   | 0x02   | 8(n)     | Pushes n arbitrary bytes to the stack
| TRIM  | 0x03   | 8(n)     | Pops n bytes from the stack
| LOAD  | 0x04   | 8(n)     | Pops n(a) and pushes `*a`
| DUP   | 0x05   | 8(n)     | Duplicates the top n bytes in the stack
| MOV   | 0x06   | 8(n_a), 8(n_b) | Pops two variables: n_a(a), n_b(b), and executes `*a = b`

### Stack operations (derivatives)

| MOVD  | 0x0A   | 8(dst)   | Executes `MOV` with a = dst
| MOVS  | 0x0B   | 8(src)   | Executes `MOV` with b = src
| MOVC  | 0x0C   | 8(src), 8(dst) | Executes `MOV` with a = dst, b = src
| PUSHB | 0x10   | 1(val)   | Pushes val to the stack
| PUSHW | 0x11   | 2(val)   | Pushes val to the stack
| PUSHD | 0x12   | 4(val)   | Pushes val to the stack
| PUSHQ | 0x13   | 8(val)   | Pushes val to the stack
| DUPB  | 0x14   |          | Executes `DUP 1`
| DUPW  | 0x15   |          | Executes `DUP 2`
| DUPD  | 0x16   |          | Executes `DUP 4`
| DUPQ  | 0x17   |          | Executes `DUP 8`

### Integer arithmetics

| Name  | Opcode | Operands | Description 
|-------|--------|----------|---
| ADD   | 0x20   | 1(size)  | Pops two variables, adds them and pushes the result
| SUB   | 0x21   | 1(size)  | Pops two variables, subtracts them and pushes the result
| NEG   | 0x22   | 1(size)  | Flips the sign of the top variable in the stack
| MUL   | 0x23   | 1(size)  | Pops two variables, multiplies them and pushes the result
| IMUL  | 0x24   | 1(size)  | Pops two variables, multiplies them (signed) and pushes the result
| DIV   | 0x25   | 1(size)  | Pops two variables, divides them and pushes the remainder, then the result
| IDIV  | 0x26   | 1(size)  | Pops two variables, divides them (signed) and pushes the remainder, then the result
| AND   | 0x27   | 1(size)  | Pops two variables, ANDs (a & b) them and pushes the remainder, then the result
| OR    | 0x28   | 1(size)  | Pops two variables, ORs (a | b) them and pushes the remainder, then the result
| XOR   | 0x29   | 1(size)  | Pops two variables, XORs (a ^ b) them and pushes the remainder, then the result
| NOT   | 0x2A   | 1(size)  | Flips the bits of the top variable
| SHL   | 0x2B   | 1(size)  | Pops two variables: a (first popped), b and performs the operation `a >> b`. Pushes the result back on the stack
| SHR   | 0x2C   | 1(size)  | Pops two variables: a (first popped), b and performs the operation `a << b`. Pushes the result back on the stack
| INC   | 0x2D   | 1(size)  | Adds one to the top variable
| DEC   | 0x2E   | 1(size)  | Subtracts one from the top variable
| CAST  | 0x2F   | 1(size_a_b) | For `size_a = size_a_b >> 4` and `size_b = size_a_b & 0xF`, converts the top 2^size_a-byte integer to a 2^size_b-byte integer

### Float arithmetics

| Name  | Opcode | Operands | Description
|-------|--------|----------|-------------
| ADDF  | 0x30   |          | Pops two variables, adds them as floats, and pushes the result
| SUBF  | 0x31   |          | Pops two variables, subtracts them as floats, and pushes the result
| MULF  | 0x32   |          | Pops two variables, multiplies them as floats, and pushes the result
| DIVF  | 0x33   |          | Pops two variables, divides them as floats (last popped is in the denominator), and pushes the result
| SQRT  | 0x34   |          | Pops a variable and pushes its square root
| STF   | 0x35   |          | Converts the top native float variable to a 64-bit IEEE float (on x86 systems, this is a NOP)
| LDF   | 0x36   |          | Converts the top 64-bit IEEE float variable to a native float (on x86 systems, this is a NOP)
| F32   | 0x37   |          | Converts the top 64-bit IEEE variable bytes to a 32-bit IEEE float
| F64   | 0x38   |          | Converts the top 32-bit IEEE variable to a 64-bit IEEE float
| ITOF  | 0x39   | 1(size)  | Converts the top 2^size-byte integer to a native float
| FTOI  | 0x3A   | 1(size)  | Converts the top native float to a 2^size-byte integer

**NOTE:** All instructions with floats work with the native float format, so be sure to execute LDF for all the operands

### Integer comparisons

| Name  | Opcode | Operands | Description 
|-------|--------|----------|---
| EQU   | 0x40   | 1(size)  | Pops 2^size(a) and 2^size(b) and pushes 2^size(`a == b`)
| LS    | 0x41   | 1(size)  | Pops 2^size(a) and 2^size(b) and pushes 2^size(`a < b`)
| GRT   | 0x42   | 1(size)  | Pops 2^size(a) and 2^size(b) and pushes 2^size(`a > b`)
| NEQ   | 0x43   | 1(size)  | Pops 2^size(a) and 2^size(b) and pushes 2^size(`a != b`)
| GRQ   | 0x44   | 1(size)  | Pops 2^size(a) and 2^size(b) and pushes 2^size(`a >= b`)
| LEQ   | 0x45   | 1(size)  | Pops 2^size(a) and 2^size(b) and pushes 2^size(`a <= b`)

### Float comparisons

| Name  | Opcode | Operands | Description 
|-------|--------|----------|---
| EQUF  | 0x50   | 1(size)  | Pops float(a) and float(b) and pushes 2^size(`a == b`)
| LSF   | 0x51   | 1(size)  | Pops float(a) and float(b) and pushes 2^size(`a < b`)
| GRTF  | 0x52   | 1(size)  | Pops float(a) and float(b) and pushes 2^size(`a > b`)
| NEQF  | 0x53   | 1(size)  | Pops float(a) and float(b) and pushes 2^size(`a != b`)
| GRQF  | 0x54   | 1(size)  | Pops float(a) and float(b) and pushes 2^size(`a >= b`)
| LEQF  | 0x55   | 1(size)  | Pops float(a) and float(b) and pushes 2^size(`a <= b`)

### Jumps

| Name  | Opcode | Operands | Description 
|-------|--------|----------|---
| JMP   | 0x60   | 2(off)   | Offsets the code execution off (signed) amount of bytes (relative to the end of the instruction)
| JT    | 0x62   | 1(size), 2(off)  | Pops a variable, and if it's true (non-zero), executes `JMP off`
| JF    | 0x63   | 1(size), 2(off)  | Pops a variable, and if it's false (zero), executes `JMP off`
| JMPD  | 0x64   | 1(size)  | Pops 2^size(a) and performs a jump to `a`

**NOTE:** Near jumps must be within the code region of the currently executed blob

**NOTE 2:** Near jumps are relative to the end of the instruction, so that `JMP 0` is a NOOP

**NOTE 3:** Far jumps are absolute (for the current context)


### Virtualization jumps

| Name  | Opcode | Operands | Description 
|-------|--------|----------|---
| INT   | 0x70   | 1(code)  | Calls the interrupt callback. This instruction is NOOP if the interrupt callback is NULL
| CALL  | 0x71   | 8(addr)  | Executes the PPCIL blob at `addr`
| CALLD | 0x72   |          | Pops 8(a) an executes `CALL a`


**NOTE2:** A jump must occur in accessible memory, and must point to a valid blob

**NOTE2:** An interrupt jump will occur in the context of the parent blob (if there isn't a parent, execution will halt)
