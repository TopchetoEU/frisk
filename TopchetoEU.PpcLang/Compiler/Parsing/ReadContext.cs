using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

/// <summary>
/// The main object, used in ++C for recursive descent parsing
/// </summary>
public class ReadContext {
    private class State {
        public int i { get; set; }
        public Location start { get; set; }
        public bool eof { get; set; }
        public bool isVirtual { get; set; }
    }
    private readonly Stack<State> states = new();
    private readonly Token[] tokens;

    private int i {
        get => states.Peek().i;
        set {
            states.Peek().i = value;
        }
    }

    private Location GetLocation(int i) {
        if (i >= tokens.Length) {
            if (tokens.Length == 0) return new(0, 0, 1, 0);
            else return tokens[^1].Location.Next(1);
        }
        else if (i < 0) return tokens[0].Location;
        else return tokens[i].Location;
    }

    /// <summary>
    /// The message stack, used to report data to the user
    /// </summary>
    public MsgStack Messages { get; }
    /// <summary>
    /// A bool value, determining whether or not there are any more tokens to consume
    /// </summary>
    public bool Ended => i >= tokens.Length;
    /// <summary>
    /// The location of the current token, or if at the end, the position of the character, after the token
    /// </summary>
    public Location TokenLocation => GetLocation(i);
    /// <summary>
    /// The location of the currently parsed value
    /// </summary>
    public Location Location => states.Peek().start.Intersect(GetLocation(i - 1));
    /// <summary>
    /// The token to be consumed. Initially, the first token.
    /// </summary>
    public Token Token => tokens[i];
    /// <summary>
    /// Consumes a token, and returns it
    /// </summary>
    public Token Consume() => tokens[i++];
    /// <summary>
    /// Backtracs once and replaces the consumed token with the given token
    /// </summary>
    public void Unconsume(Token t) => tokens[i] = t;

    /// <summary>
    /// Executes a reader
    /// </summary>
    /// <typeparam name="T">The type of the result</typeparam>
    /// <param name="reader">The reader to use</param>
    public ReadResult<T> Read<T>(Reader<T> reader) {
        return reader(this.Child());
    }
    /// <summary>
    /// Executes a reader
    /// </summary>
    /// <typeparam name="T">The type of the result</typeparam>
    /// <typeparam name="T2">The type of the argument <paramref name="reader"/> accepts</typeparam>
    /// <param name="reader">The reader to use</param>
    /// <param name="arg">The argument to pass to <paramref name="reader"/></param>
    public ReadResult<T> Read<T, T2>(ArgumentReader<T, T2> reader, T2 arg) {
        return reader(this.Child(), arg);
    }

    /// <summary>
    /// Executes a reader
    /// </summary>
    /// <typeparam name="T">The type of the result</typeparam>
    /// <param name="reader">The reader to use</param>
    /// <param name="res">Return value gets put here, too</param>
    public ReadResult<T> Read<T>(Reader<T> reader, out ReadResult<T> res) {
        return res = reader(this.Child());
    }
    /// <summary>
    /// Executes a reader
    /// </summary>
    /// <typeparam name="T">The type of the result</typeparam>
    /// <typeparam name="T2">The type of the argument <paramref name="reader"/> accepts</typeparam>
    /// <param name="reader">The reader to use</param>
    /// <param name="arg">The argument to pass to <paramref name="reader"/></param>
    /// <param name="res">Return value gets put here, too</param>
    public ReadResult<T> Read<T, T2>(ArgumentReader<T, T2> reader, T2 arg, out ReadResult<T> res) {
        return res = reader(this.Child(), arg);
    }

    /// <summary>
    /// Executes a reader, without consuming anything
    /// </summary>
    /// <typeparam name="T">The type of the result</typeparam>
    /// <param name="reader">The reader to use</param>
    public ReadResult<T> Check<T>(Reader<T> reader) {
        return reader(this.VirtualChild());
    }
    /// <summary>
    /// Executes a reader, without consuming anything
    /// </summary>
    /// <typeparam name="T2">The type of the argument <paramref name="reader"/> accepts</typeparam>
    /// <param name="reader">The reader to use</param>
    /// <param name="arg">The argument to pass to <paramref name="reader"/></param>
    public ReadResult<T> Check<T, T2>(ArgumentReader<T, T2> reader, T2 arg) {
        return reader(this.VirtualChild(), arg);
    }
    /// <summary>
    /// Pushes one state, going one level deeper in the recursion.
    /// A consequitve <seealso cref="Success"/> call will commit any consumption, and a <seealso cref="Fail"/> call will abort all consumption
    /// </summary>
    /// <returns>The current instance (this)</returns>
    public ReadContext Child() {
        states.Push(new() {
            eof = Ended,
            i = i,
            start = TokenLocation,
            isVirtual = false,
        });
        return this;
    }
    /// <summary>
    /// Like Child, but won't commit any consumption. Used for testing a parser, without actually consuming anything
    /// </summary>
    /// <returns>The current instance (this)</returns>
    public ReadContext VirtualChild() {
        states.Push(new() {
            eof = Ended,
            i = i,
            start = TokenLocation,
            isVirtual = true,
        });
        return this;
    }

    /// <summary>
    /// Generates an error, based on the current location and consumption state
    /// </summary>
    /// <param name="val">The error message</param>
    /// <param name="loc">The location to use. If null, will use the current token location</param>
    public ErrorMessage GetError(string val, Location? loc = null) {
        if (states.Peek().eof) return new("Unexpected end - " + val, loc ?? GetLocation(tokens.Length));
        else return new(val, loc ?? Location);
    }

    /// <summary>
    /// Goes one recursion level back, but doesn't commit any consumption.
    /// Returns an error, that would be generated by <seealso cref="GetError"/>, encapsulated in <seealso cref="FailedReadResult"/>
    /// </summary>
    /// <param name="val">The error message</param>
    /// <param name="loc">The location to use. If null, will use the current token location</param>
    /// <exception cref="InvalidOperationException">Thrown if there are no recursion levels to revert</exception>
    public FailedReadResult Fail(bool fatal, string val, Location? loc = null) {
        if (states.Count <= 1) throw new InvalidOperationException("Fail may not be called on a top-level context.");
        var err = new FailedReadResult(fatal, GetError(val, loc));
        states.Pop();
        return err;
    }
    /// <summary>
    /// Goes one recursion level back, but doesn't commit any consumption.
    /// Returns the error, encapsulated in <seealso cref="FailedReadResult"/>
    /// </summary>
    /// <param name="error">The error to encapsulate</param>
    /// <exception cref="InvalidOperationException">Thrown if there are no recursion levels to revert</exception>
    public FailedReadResult Fail(bool fatal, ErrorMessage error) {
        if (states.Count <= 1) throw new InvalidOperationException("Fail may not be called on a top-level context.");
        var err = new FailedReadResult(fatal, error);
        states.Pop();
        return err;
    }

    /// <summary>
    /// Goes one recursion level back, but doesn't commit any consumption.
    /// Returns an error, generated by <seealso cref="GetError"/>, that will inherit <paramref name="res"/>'s message, encapsulated in <seealso cref="FailedReadResult"/>
    /// </summary>
    /// <param name="val">The error message</param>
    /// <param name="loc">The location to use. If null, will use the current token location</param>
    /// <exception cref="InvalidOperationException">Thrown if there are no recursion levels to revert</exception>
    public FailedReadResult Fail<T>(bool fatal, ReadResult<T> res, string val, Location? loc = null) {
        if (states.Count <= 1) throw new InvalidOperationException("Fail may not be called on a top-level context.");
        var err = FailedReadResult.Inherit(fatal, GetError(val, loc), res.Error);
        states.Pop();
        return err;
    }
    /// <summary>
    /// Goes one recursion level back, but doesn't commit any consumption.
    /// Returns the error, encapsulated in <seealso cref="FailedReadResult"/>
    /// </summary>
    /// <param name="error">The error to encapsulate</param>
    /// <exception cref="InvalidOperationException">Thrown if there are no recursion levels to revert</exception>
    public FailedReadResult Fail<T>(bool fatal, ReadResult<T> res, ErrorMessage? error = null) {
        if (states.Count <= 1) throw new InvalidOperationException("Fail may not be called on a top-level context.");
        var err = FailedReadResult.Inherit(fatal, error, res.Error);
        states.Pop();
        return err;
    }

    /// <summary>
    /// Goes one recursion level back, and commits all consumption (unless current level is created by <seealso cref="VirtualChild"/>).
    /// Returns the parsed value, encapsulated in <seealso cref="ReadResult{T}"/>
    /// </summary>
    /// <typeparam name="T">The result type</typeparam>
    /// <exception cref="InvalidOperationException">Thrown if there are no recursion levels to revert</exception>
    public ReadResult<T> Success<T>(T result) {
        if (states.Count <= 1) throw new InvalidOperationException("Success may not be called on a top-level context.");
        var state = states.Pop();
        if (!state.isVirtual) this.i = state.i;
        return new(result);
    }
    /// <summary>
    /// Goes one recursion level back, and commits all consumption (unless current level is created by <seealso cref="VirtualChild"/>).
    /// Creates a <seealso cref="Located{T}"/>, encapsulates it in a <seealso cref="ReadResult{}"/>, and returns it
    /// </summary>
    /// <typeparam name="T">The unlocated result type</typeparam>
    /// <exception cref="InvalidOperationException">Thrown if there are no recursion levels to revert</exception>
    public ReadResult<Located<T>> Success<T>(T result, Location? loc) {
        if (states.Count <= 1) throw new InvalidOperationException("Success may not be called on a top-level context.");
        if (!loc.HasValue) {
            loc = Location;
        }
        var state = states.Pop();
        if (!state.isVirtual) this.i = state.i;
        return new(new Located<T>(result, loc.Value));
    }

    public ReadContext(MsgStack messages, IEnumerable<Token> tokens) {
        this.Messages = messages;
        this.tokens = tokens.ToArray();
        this.states.Push(new() {
            eof = this.tokens.Length == 0,
            isVirtual = false,
            start = GetLocation(0),
            i = 0,
        });
    }
}
