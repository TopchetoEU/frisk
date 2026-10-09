# Scripting vs "real" languages

All of us have encountered the usage of the "scrpting language" term, but what does it actually mean? Some of the qualities that set apart the scripting languages (most of them) from the rest are:

## Dynamicity

Most scripting languages are dynamic, or you can find out the true nature of a value until you run the program. This can be said about any language, really, because a language is made to solve a problem, and a problem brings about a level of unpredictability, aka the need for a runtime (we truly live in a runtime). In fact, a truly non-dynamic language wouldn't need syntax or anything, because it would statically check everything and would need no pesky runtime to mess things up. I will take the liberty of calling this language 42, as making a truly static language requires a deterministic universe and a dash of fortune-telling - this language knows the problem you will AND its solution before you've even had it

## Typing (and the lack of it)

We have two ends of the scales in terms of typing - strong and weak typing. But what is typing anyways? Typing in layman's terms is the ability of the compiler to determine to a degree what pattern runtime values will follow.

The weakest typing is no typing at all, or in other words, the compiler knows jack shit about the runtime values, and the programmer is left with the task of figuring out how to work with the unpredictable input he gets.

On the other side of the coin, we have strong typing, which will ensure that values follow an exact structure - for example, your function won't just take 2 parameters, but the first is going to be a 16-bit integer and the second will be a boolean. Now, some might say that this still has some elements of unpredictability, as the first argument still has 65536 possible values, which we haven't comprehensively accounted for. In fact, a true strongly typed language would allow you to only accept specific values, as input. For example, take this SIMPLE function for adding two numbers in my new language, pedanticatron:

```
2 add(1 a, 1 b);
3 add(1 a, 2 b);
3 add(2 a, 1 b);
...
// when will my suffering end
65536 add(65535 a, 1 b);
65536 add(65536 a, 0 b);
```

As you can see, such a language is not feasible, as too much typing becomes restrictive and more of a hassle than a help. Another thing we could say about the correlation between dynamicity and typing is that generally, the stronger the typing, the less dynamic a language becomes and vice-versa.

## Top level code

Most scripting languages are known for allowing the programmer to directly write top-level code, without too much hassle. This is pretty self-explanatory, as when you write scripts, you usually try to solve a problem quickly, usually gluing two bigger systems together. For example, when you want to tell your nginx server to redirect all HTTPS requests to myawesomeblog.thebestblogger.com/* to some web server, you go in the (utterly confusing) nginx config files and add 5-6 lines of config to instruct nginx to do so. The last thing you want to do in this case is to deal with some esoteric bolierplate-bloated language two people on this planet understand. But this isn't really a good answer to what makes a language scripting language.

## The awareness the language has of its environment

Now we're getting somewhere. All of the previous examples alluded to the amount of knowledge the lanugage and the compiler has about the environment it's going to execute in. Languages that are traditionally scripting don't know too much about their environment - javascript, python, lua - they could be running in a browser, powering a space mission (please god never do this), used as a modding too in a game, etc. Those languages couldn't care less - you just have to plug in the correct global scope with the correct function calls, and your PNG decoder library will still (probably) work.

On the other hand, normal lanugages have an acute awarenes of their environment. 