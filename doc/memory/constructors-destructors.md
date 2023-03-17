# Constructors and destructors

In ++C, constructors and destructors are used to gracefully initialize the object into a valid state and when, needed, gracefully free all resources, used by the object.

## Constructors

A constructor is a special function, that can take any amount of parameters, but returns nothing. It can only be called via the name of the struct name itself:

```cpp
struct test {
    constructor() {

    }
}

test(); // Calling constructor of test
```

Unlike some of the OOP languages, `new` is not used for calling constructors. Instead, `new` is used to move the given value into heap and return an unowned pointer to that place in memory.

## Destructors

A destructor is a special function, that must be exported, but isn't either visible, nor callable by normal code. It takes no parameters and returns void. A destructor is responsible for freeing all resources, used by the object. When a destructor is called, the destructors of all the object's fields will be called, too.
