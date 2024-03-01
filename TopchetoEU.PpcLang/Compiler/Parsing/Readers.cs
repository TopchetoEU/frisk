using System.Numerics;
using System.Text.RegularExpressions;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing;

/// <summary>
/// A collection of parsers, commonly used in ++C
/// </summary>
public static class Readers {
    /// <summary>
    /// Reads an identifier
    /// </summary>
    public static ReadResult<Located<string>> ReadIdentifier(ReadContext ctx) {
        if (ctx.Ended) return ctx.Fail(false, "Expected an identifier");
        var token = ctx.Consume();
        if (!token.IsIdentifier) return ctx.Fail(false, "Expected an identifier");
        return ctx.Success(token.Identifier, token.Location);
    }
    /// <summary>
    /// Reads an identifier, that must match <paramref name="match"/>
    /// </summary>
    /// <param name="match">The identifier to match with</param>
    public static ReadResult<Located<string>> ReadIdentifier(ReadContext ctx, string match) {
        if (ctx.Ended) return ctx.Fail(false, $"Expected '{match}'");
        var token = ctx.Consume();
        if (!token.IsIdentifier) return ctx.Fail(false, $"Expected '{match}'");
        if (match != token.Identifier) return ctx.Fail(false, $"Expected '{match}'");
        return ctx.Success(token.Identifier, token.Location);
    }
    /// <summary>
    /// Reads an operator
    /// </summary>
    public static ReadResult<Located<Operator>> ReadOperator(ReadContext ctx) {
        if (ctx.Ended) return ctx.Fail(false, "Expected an operator");
        var token = ctx.Consume();
        if (!token.IsOperator) return ctx.Fail(false, "Expected an operator.");
        return ctx.Success(token.Operator, token.Location);
    }
    /// <summary>
    /// Reads an operator, that must match <paramref name="match"/>
    /// </summary>
    /// <param name="match">The operator to match with</param>
    public static ReadResult<Located<Operator>> ReadOperator(ReadContext ctx, Operator match) {
        if (ctx.Ended) return ctx.Fail(false, $"Expected an operator '{match.Readable(true)}'");
        var token = ctx.Consume();
        if (!token.IsOperator) return ctx.Fail(false, $"Expected an operator '{match.Readable(true)}'");
        if (match != token.Operator) return ctx.Fail(false, $"Expected an operator '{match.Readable(true)}'");
        return ctx.Success(token.Operator, token.Location);
    }
    /// <summary>
    /// Reads an integer literal
    /// </summary>
    public static ReadResult<Located<BigInteger>> ReadIntLiteral(ReadContext ctx) {
        if (ctx.Ended) return ctx.Fail(false, "Expected an integer literal.");
        var token = ctx.Consume();
        if (!token.IsIntLiteral) return ctx.Fail(false, "Expected an integer literal.");
        return ctx.Success(token.IntLiteral, token.Location);
    }
    /// <summary>
    /// Reads an integer literal
    /// </summary>
    public static ReadResult<Located<byte[]>> ReadStringLiteral(ReadContext ctx) {
        if (ctx.Ended) return ctx.Fail(false, "Expected a string literal.");
        var token = ctx.Consume();
        if (!token.IsStringLiteral) return ctx.Fail(false, "Expected a string literal.");
        return ctx.Success(token.StringLiteral, token.Location);
    }

    /// <summary>
    /// Reads a namespace (a::b::c::d...)
    /// </summary>
    public static ReadResult<Located<Namespace>> ReadNamespace(ReadContext ctx) {
        var res = new List<string>();
        if (!ctx.Read(ReadIdentifier, out var first)) return ctx.Fail(false, first, "Expected a namespace");
        var loc = first.Result.Location;
        res.Add(first.Result.Value);

        while (ctx.Read(ReadOperator, Operator.DoubleColon)) {
            var val = ctx.Read(ReadIdentifier);
            if (!val) return ctx.Fail(true, "Expected identifier after double colons");
            res.Add(val.Result.Value);
            loc = loc.Intersect(val.Result.Location);
        }

        return ctx.Success(new Namespace(res), loc);
    }

    // This is fucking why im making ++C
    public static Reader<T2> Cast<T, T2>(this Reader<T> reader) where T : T2 {
        return (ctx) => {
            var res = reader(ctx);
            if (res) return new ReadResult<T2>(res.Result);
            else return new FailedReadResult(res.Fatal, res.Error);
        };
    }
    public static ArgumentReader<T2, ArgT> Cast<T, T2, ArgT>(this Reader<T> reader) where T : T2 {
        return (ctx, arg) => {
            var res = reader(ctx);
            if (res)
                return new ReadResult<T2>(res.Result);
            else
                return new FailedReadResult(res.Fatal, res.Error);
        };
    }
    public static ArgumentReader<T2, ArgT> Cast<T, T2, ArgT>(this ArgumentReader<T, ArgT> reader) where T : T2 {
        return (ctx, arg) => {
            var res = reader(ctx, arg);
            if (res) return new ReadResult<T2>(res.Result);
            else return new FailedReadResult(res.Fatal, res.Error);
        };
    }
}
