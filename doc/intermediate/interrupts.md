# Interrupts in PPCIL

An interrupt is used for two-way communication between the interpreter and the executing code. Interrupts can be sent by the interpreter to the executing code (for example, keyboard interrupts, clock interrupts, etc.), and from the executing code to the interpreter (for example, writing to the console, reading a file, requesting more heap, etc.).

## Interrupt handlers

Interrupt handles are defined by calling the `ITHN` function, which will set the current context's interrupt handler to the specified pointer. An interrupt handler is a function, that takes a singe byte as an argument and returns a single byte integer. The parameter is the index of the interrupt being processed, and the return value signifies if the interrupt has been processed (1), or the interrupt should be passed to the interpreter (0).

An example for an interrupt handler (in ++C) would be the following:

```c++
import std::intr;
import std::io;

int_hnd(code: byte): bool {
    if (code == 0) {
        printf("The clock has spoken");
        return 1;
    }
    return 0;
}

export main() {
    set_int_hnd(int_hnd);
    while (true) {
        // Prevent the program from stopping
    }
}

```

## Self-interrupting

If the program has defined an interrupt handler, that properly handles a certain interrupt (let's say `10h`), and the program executes `INT 10h`, then the program will have effectively interrupted itself, without it have ever reached the interpreter.