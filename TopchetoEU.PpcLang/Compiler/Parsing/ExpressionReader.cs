using System;
using System.Collections.Immutable;
using System.Net.NetworkInformation;
using System.Numerics;
using System.Text;
using TopchetoEU.PpcLang.Compiler.Tree;
using TopchetoEU.PpcLang.Utils;

namespace TopchetoEU.PpcLang.Compiler.Parsing.Definitions;

public record struct VariableLiteral(Namespace Name, Location Location): IExpression {
    public override string ToString() {
        return new StringBuilder()
            .Append(Name.ToString())
            .Append('@')
            .Append(Location.ToString())
            .ToString();
    }
}
public record struct IntLiteral(BigInteger Value, Location Location): IExpression {
    public override string ToString() {
        return new StringBuilder()
            .Append(Value.ToString())
            .Append('@')
            .Append(Location.ToString())
            .ToString();
    }
}
public record struct StringLiteral(byte[] Value, Location Location): IExpression {
    public override string ToString() {
        var res = new StringBuilder().Append('"');
        foreach (var item in Value) {
            if (item < 32 || item >= 127) res.Append("\\x" + item.ToString("X2"));
            else res.Append((char)item);
        }
        res.Append("\"@").Append(Location.ToString());
        return res.ToString();
    }
}

public record struct PostfixOperator(IExpression Value, Operator Operator, Location Location): IExpression {
    public string ToString(int indent = 0) {
        var res = new StringBuilder()
            .Append("Postfix")
            .Append('@')
            .AppendLine(Location.ToString());

        res.Append('\t', indent + 1)
            .Append("Operator: ")
            .AppendLine(Operator.ToString());

        res.Append('\t', indent + 1)
            .Append("Value: ")
            .Append(Value.ToString(indent + 1));

        return res.ToString();
    }
}
public record struct PrefixOperator(IExpression Value, Operator Operator, Location Location): IExpression {
    public string ToString(int indent = 0) {
        var res = new StringBuilder()
            .Append("Prefix")
            .Append('@')
            .AppendLine(Location.ToString());

        res.Append('\t', indent + 1)
            .Append("Operator: ")
            .AppendLine(Operator.ToString());

        res.Append('\t', indent + 1)
            .Append("Value: ")
            .Append(Value.ToString(indent + 1));

        return res.ToString();
    }
}

public record struct BinaryOperator(IExpression A, IExpression B, Operator Operator, Location Location): IExpression {
    public string ToString(int indent = 0) {
        var res = new StringBuilder()
            .Append("Binary")
            .Append('@')
            .AppendLine(Location.ToString());

        res.Append('\t', indent + 1)
            .Append("Operator: ")
            .AppendLine(Operator.ToString());

        res.Append('\t', indent + 1)
            .Append("A: ")
            .AppendLine(A.ToString(indent + 1));

        res.Append('\t', indent + 1)
            .Append("B: ")
            .Append(B.ToString(indent + 1));

        return res.ToString();
    }
}
public record struct TernaryOperator(IExpression Condition, IExpression A, IExpression B, Location Location): IExpression {
    public string ToString(int indent = 0) {
        var res = new StringBuilder()
            .Append("Ternary")
            .Append('@')
            .AppendLine(Location.ToString());

        res.Append('\t', indent + 1)
            .Append("Condition: ")
            .AppendLine(Condition.ToString(indent + 1));

        res.Append('\t', indent + 1)
            .Append("A: ")
            .AppendLine(A.ToString(indent + 1));

        res.Append('\t', indent + 1)
            .Append("B: ")
            .Append(B.ToString(indent + 1));

        return res.ToString();
    }
}
public record struct CallExpression(IExpression Callee, Location Location, params IExpression[] Arguments): IExpression {
    public string ToString(int indent = 0) {
        var res = new StringBuilder()
            .Append("Call")
            .Append('@')
            .AppendLine(Location.ToString());

        res.Append('\t', indent + 1)
            .Append("Callee: ")
            .AppendLine(Callee.ToString(indent + 1));

        res.Append('\t', indent + 1).AppendLine("Arguments: ");

        foreach (var arg in Arguments) {
            res.Append('\t', indent + 2).AppendLine(arg.ToString(indent + 2));
        }

        return res.ToString();
    }
}
public record struct CastExpression(IExpression Value, TypeName Type, Location Location): IExpression {
    public string ToString(int indent = 0) {
        var res = new StringBuilder()
            .Append("Cast")
            .Append('@')
            .AppendLine(Location.ToString());

        res.Append('\t', indent + 1)
            .Append("Value: ")
            .AppendLine(Value.ToString(indent + 1));
        res.Append('\t', indent + 1)
            .Append("Type: ")
            .Append(Type.ToString());

        return res.ToString();
    }
}

public record ExpressionArgument(Precedence Precedence, IExpression? Previous = null);

public class ExpressionReader {
    private static readonly Operator[] prefix = {
        Operator.Bang,
        Operator.DoubleBang,
        Operator.BitwiseNot,
        Operator.Add,
        Operator.Subtract,
        Operator.Increase,
        Operator.Decrease,
    };
    private static readonly Operator[] postfix = { Operator.Increase, Operator.Decrease };

    public ArgumentChoiceReader<IExpression, ExpressionArgument> Segments { get; } = new("expression part");
    public Reader<TypeName> TypeReader { get; set; }

    public ReadResult<IExpression> Read(ReadContext ctx, Precedence precedence) {
        if (!ctx.Read(Segments.Read, new ExpressionArgument(precedence, null), out var first)) {
            if (first.Fatal) return ctx.Fail(first.Fatal, "Incorrect expression");
            else return ctx.Fail(first.Fatal, "Expected an expression");
        }
        var res = first.Result;

        while (true) {
            if (!ctx.Read(Segments.Read, new ExpressionArgument(precedence, res), out var exp)) {
                if (exp.Fatal) return ctx.Fail(exp.Fatal, "Incorrect expression");
                else return ctx.Success(res);
            }
            res = exp.Result;
        }
    }
    public ReadResult<IExpression> Read(ReadContext ctx) => Read(ctx, Precedence.All);

    public ReadResult<VariableLiteral> ReadVariable(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous != null) return ctx.Fail(false, "Unexpected place for int literal");
        if (!ctx.Read(Readers.ReadNamespace, out var res)) return ctx.Fail(false, "Expected a variable name");
        return ctx.Success(new VariableLiteral(res.Result.Value, ctx.Location));
    }
    public ReadResult<IntLiteral> ReadInt(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous != null) return ctx.Fail(false, "Unexpected place for int literal");
        if (!ctx.Read(Readers.ReadIntLiteral, out var res)) return ctx.Fail(false, "Expected an int literal");
        return ctx.Success(new IntLiteral(res.Result.Value, ctx.Location));
    }
    public ReadResult<StringLiteral> ReadString(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous != null) return ctx.Fail(false, "Unexpected place for string literal");
        if (!ctx.Read(Readers.ReadStringLiteral, out var res)) return ctx.Fail(false, "Expected a string literal");
        else return ctx.Success(new StringLiteral(res.Result.Value, ctx.Location));
    }
    public ReadResult<PostfixOperator> ReadPostfix(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for postfix operator");
        if (arg.Precedence == Precedence.None) return ctx.Fail(false, "Precedence too high for postfix operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);
        
        var op = opRes.Result.Value;
        if (op.IsAny(postfix)) return ctx.Success(new PostfixOperator(arg.Previous, op, ctx.Location));
        else return ctx.Fail(false, "Expected a postfix operator");
    }
    public ReadResult<PrefixOperator> ReadPrefix(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous != null) return ctx.Fail(false, "Unexpected place for prefix operator");
        if (arg.Precedence > Precedence.Prefix) return ctx.Fail(false, "Precedence too high for postfix operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);
        
        var op = opRes.Result.Value;
        if (!op.IsAny(prefix)) {
            return ctx.Fail(false, "Expected a postfix operator");
        }
        if (!ctx.Read(Read, Precedence.Prefix, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new PrefixOperator(expRes.Result, op, ctx.Location));
    }
    public ReadResult<IExpression> ReadParens(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous != null) return ctx.Fail(false, "Unexpected place for parens");
        if (!ctx.Read(Readers.ReadOperator, Operator.ParenOpen, out var opRes)) return ctx.Fail(false, opRes);
        if (!ctx.Read(Read, Precedence.All, out var expRes)) return ctx.Fail(true, expRes);
        if (!ctx.Read(Readers.ReadOperator, Operator.ParenClose, out opRes)) return ctx.Fail(false, opRes);

        return ctx.Success(expRes.Result);
    }
    public ReadResult<CallExpression> ReadCall(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for call");
        if (!ctx.Read(Readers.ReadOperator, Operator.ParenOpen, out var opRes)) return ctx.Fail(false, opRes);

        if (ctx.Read(Readers.ReadOperator, Operator.ParenClose)) return ctx.Success(new CallExpression(arg.Previous, ctx.Location));

        var args = new List<IExpression>();

        while (true) {
            if (!ctx.Read(Read, Precedence.All, out var expRes)) return ctx.Fail(true, expRes);
            args.Add(expRes.Result);
            if (ctx.Read(Readers.ReadOperator, Operator.Comma)) continue;
            else if (ctx.Read(Readers.ReadOperator, Operator.ParenClose)) return ctx.Success(new CallExpression(arg.Previous, ctx.Location, args.ToArray()));
            else ctx.Fail(true, "Invalid call expression - Expected a comma or a closing paren after argument");
        }
    }
    public ReadResult<CastExpression> ReadCast(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for cast");
        if (!ctx.Read(Readers.ReadOperator, Operator.Colon, out var opRes)) return ctx.Fail(false, opRes);
        if (!ctx.Read(TypeReader, out var typeRes)) return ctx.Fail(true, typeRes, "Incorrect cast expression");

        return ctx.Success(new CastExpression(arg.Previous, typeRes, ctx.Location));
    }

    public ReadResult<BinaryOperator> ReadAssign(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for assign operator");
        if (arg.Precedence > Precedence.Assignment) return ctx.Fail(false, "Precedence too high for assign operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);

        var op = opRes.Result.Value;
        if (!op.IsAny(
            Operator.Assign,
            Operator.AssignAdd, Operator.AssignSubtract,
            Operator.AssignMultiply, Operator.AssignDivide, Operator.AssignModulo,
            Operator.AssignAnd, Operator.AssignOr, Operator.AssignXor,
            Operator.AssignDoubleAnd, Operator.AssignDoubleOr,
            Operator.AssignShiftLeft, Operator.AssignShiftRight
        )) return ctx.Fail(false, "Expected an assign operator");
        if (!ctx.Read(Read, Precedence.Assignment, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, op, ctx.Location));
    }
    public ReadResult<TernaryOperator> ReadTernary(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for ternary operator");
        if (arg.Precedence > Precedence.Ternary) return ctx.Fail(false, "Precedence too high for ternary operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.Question, out var opRes)) return ctx.Fail(false, opRes, "Expected a ternary operator");
        if (!ctx.Read(Read, Precedence.Ternary, out var aRes)) return ctx.Fail(true, aRes, "Incorrect ternary operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.Colon, out opRes)) return ctx.Fail(false, opRes, "Incorrect ternary operator");
        if (!ctx.Read(Read, Precedence.Ternary, out var bRes)) return ctx.Fail(true, bRes, "Incorrect ternary operator");

        return ctx.Success(new TernaryOperator(arg.Previous, aRes.Result, bRes.Result, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadLazyOr(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for lazy or operator");
        if (arg.Precedence > Precedence.LazyOr) return ctx.Fail(false, "Precedence too high for lazy or operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.DoubleOr, out var opRes)) return ctx.Fail(false, opRes, "Expected a lazy or operator");
        if (!ctx.Read(Read, Precedence.LazyOr + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, Operator.DoubleOr, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadLazyAnd(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for lazy and operator");
        if (arg.Precedence > Precedence.LazyAnd) return ctx.Fail(false, "Precedence too high for lazy and operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.DoubleAnd, out var opRes)) return ctx.Fail(false, opRes, "Expected a lazy and operator");
        if (!ctx.Read(Read, Precedence.LazyAnd + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, Operator.DoubleAnd, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadOr(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for or operator");
        if (arg.Precedence > Precedence.Or) return ctx.Fail(false, "Precedence too high for or operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.Or, out var opRes)) return ctx.Fail(false, opRes, "Expected an or operator");
        if (!ctx.Read(Read, Precedence.Or + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, Operator.Or, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadXor(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for xor operator");
        if (arg.Precedence > Precedence.Xor) return ctx.Fail(false, "Precedence too high for xor operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.Xor, out var opRes)) return ctx.Fail(false, opRes, "Expected an xor operator");
        if (!ctx.Read(Read, Precedence.Xor + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, Operator.Xor, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadAnd(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for and operator");
        if (arg.Precedence > Precedence.And) return ctx.Fail(false, "Precedence too high for and operator");
        if (!ctx.Read(Readers.ReadOperator, Operator.And, out var opRes)) return ctx.Fail(false, opRes, "Expected an and operator");
        if (!ctx.Read(Read, Precedence.And + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, Operator.And, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadEquality(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for equality operator");
        if (arg.Precedence > Precedence.Equality) return ctx.Fail(false, "Precedence too high for equality operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);

        var op = opRes.Result.Value;
        if (!op.IsAny(Operator.Equals, Operator.NotEquals)) return ctx.Fail(false, "Expected an equality operator");
        if (!ctx.Read(Read, Precedence.Equality + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, op, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadComparasion(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for comparasion operator");
        if (arg.Precedence > Precedence.Comparasion) return ctx.Fail(false, "Precedence too high for comparasion operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);

        var op = opRes.Result.Value;
        if (!op.IsAny(
            Operator.LessThan, Operator.GreaterThan,
            Operator.LessThanEquals, Operator.GreaterThanEquals
        )) return ctx.Fail(false, "Expected a comparasion operator");
        if (!ctx.Read(Read, Precedence.Shift + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, op, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadShift(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for shift operator");
        if (arg.Precedence > Precedence.Shift) return ctx.Fail(false, "Precedence too high for shift operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);

        var op = opRes.Result.Value;
        if (!op.IsAny(Operator.ShiftLeft, Operator.ShiftRight)) return ctx.Fail(false, "Expected a shift operator");
        if (!ctx.Read(Read, Precedence.Shift + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, op, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadAdditive(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for additive operator");
        if (arg.Precedence > Precedence.Additive) return ctx.Fail(false, "Precedence too high for additive operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);

        var op = opRes.Result.Value;
        if (!op.IsAny(Operator.Add, Operator.Subtract)) return ctx.Fail(false, "Expected an additive operator");
        if (!ctx.Read(Read, Precedence.Additive + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, op, ctx.Location));
    }
    public ReadResult<BinaryOperator> ReadMultiplicative(ReadContext ctx, ExpressionArgument arg) {
        if (arg.Previous == null) return ctx.Fail(false, "Unexpected place for multiplicative operator");
        if (arg.Precedence > Precedence.Multiplicative) return ctx.Fail(false, "Precedence too high for multiplicative operator");
        if (!ctx.Read(Readers.ReadOperator, out var opRes)) return ctx.Fail(false, opRes);

        var op = opRes.Result.Value;
        if (!op.IsAny(Operator.Multiply, Operator.Divide, Operator.Modulo)) return ctx.Fail(false, "Expected a multiplicative operator");
        if (!ctx.Read(Read, Precedence.Multiplicative + 1, out var expRes)) return ctx.Fail(true, expRes);

        return ctx.Success(new BinaryOperator(arg.Previous, expRes.Result, op, ctx.Location));
    }

    public ExpressionReader(Reader<TypeName> typeReader) {
        TypeReader = typeReader;
    }
}
