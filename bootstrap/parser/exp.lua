local node = require "bootstrap.util.node";
local err = require "bootstrap.util.err";
local common = require "bootstrap.parser.common";

local error = err.throw;
local parse_op = common.parse_op;
local parse_any_op = common.parse_any_op;
local parse_id = common.parse_id;
local parse_signature = common.parse_signature;
local parse_struct_body = common.parse_struct_body;

local pre_op_map = {
	["!"] = node.ops.NOT,
	["-"] = node.ops.NEG,
	["+"] = node.ops.POS,
	["~"] = node.ops.B_NEG,
	["*"] = node.ops.REF,
	["&"] = node.ops.DEREF,
};
local bin_op_map = {
	["**"] = node.ops.POW,
	["+"] = node.ops.ADD,
	["-"] = node.ops.SUB,
	["*"] = node.ops.MUL,
	["/"] = node.ops.DIV,
	["%"] = node.ops.MOD,
	[".."] = node.ops.CAT,

	["<<"] = node.ops.B_SHL,
	[">>"] = node.ops.B_SHR,
	["&"] = node.ops.B_AND,
	["|"] = node.ops.B_OR,
	["^"] = node.ops.B_XOR,

	["&&"] = node.ops.AND,
	["||"] = node.ops.OR,

	["=="] = node.ops.EQ,
	["!="] = node.ops.NEQ,
	["<"] = node.ops.LE,
	[">"] = node.ops.GR,
	["<="] = node.ops.LEQ,
	[">="] = node.ops.GREQ,
};
local assign_op_map = {
	["**="] = node.ops.POW,
	["+="] = node.ops.ADD,
	["-="] = node.ops.SUB,
	["*="] = node.ops.MUL,
	["/="] = node.ops.DIV,
	["%="] = node.ops.MOD,
	["..="] = node.ops.CAT,

	["<<="] = node.ops.B_SHL,
	[">>="] = node.ops.B_SHR,
	["&="] = node.ops.B_AND,
	["|="] = node.ops.B_OR,
	["^="] = node.ops.B_XOR,

	["&&="] = node.ops.AND,
	["||="] = node.ops.OR,

	"=",
};
local post_op_map = {
	["!"] = node.ops.ASSERT,
	["?"] = node.ops.TRY,
	["@"] = node.ops.SPELONDGE,
};

local op_banmasks = {
	ASSIGN = 1 << 0,
	OR = 1 << 1,
	AND = 1 << 2,
	CMP = 1 << 3,
	B_XOR = 1 << 4,
	B_OR = 1 << 5,
	B_AND = 1 << 6,
	SHIFTS = 1 << 7,
	CAT = 1 << 8,
	ADD = 1 << 9,
	MUL = 1 << 10,
	POW = 1 << 11,
	UNARY = 1 << 12,
};
local op_precmasks = {
	[node.ops.POW] = op_banmasks.POW - 1,
	[node.ops.ADD] = op_banmasks.MUL - 1,
	[node.ops.SUB] = op_banmasks.MUL - 1,
	[node.ops.MUL] = op_banmasks.POW - 1,
	[node.ops.DIV] = op_banmasks.POW - 1,
	[node.ops.MOD] = op_banmasks.POW - 1,
	[node.ops.CAT] = op_banmasks.CAT - 1,

	[node.ops.B_SHL] = op_banmasks.CAT - 1,
	[node.ops.B_SHR] = op_banmasks.CAT - 1,
	[node.ops.B_AND] = op_banmasks.SHIFTS - 1,
	[node.ops.B_OR] = op_banmasks.B_AND - 1,
	[node.ops.B_XOR] = op_banmasks.B_OR - 1,

	[node.ops.EQ] = op_banmasks.B_XOR - 1,
	[node.ops.NEQ] = op_banmasks.B_XOR - 1,
	[node.ops.LE] = op_banmasks.B_XOR - 1,
	[node.ops.GR] = op_banmasks.B_XOR - 1,
	[node.ops.LEQ] = op_banmasks.B_XOR - 1,
	[node.ops.GREQ] = op_banmasks.B_XOR - 1,

	[node.ops.AND] = op_banmasks.OR - 1,
	[node.ops.OR] = op_banmasks.AND - 1,

	[node.ops.NOT] = op_banmasks.UNARY - 1,
	[node.ops.NEG] = op_banmasks.UNARY - 1,
	[node.ops.POS] = op_banmasks.UNARY - 1,
	[node.ops.B_NEG] = op_banmasks.UNARY - 1,
	[node.ops.REF] = op_banmasks.UNARY - 1,
	[node.ops.DEREF] = op_banmasks.UNARY - 1,

	[node.ops.TRY] = op_banmasks.UNARY - 1,
	[node.ops.ASSERT] = op_banmasks.UNARY - 1,
	[node.ops.SPELONDGE] = op_banmasks.UNARY - 1,
};

local exp = {};

--- @param ctx parser.ctx
--- @param i integer
function exp.parse_exp_parens(ctx, i)
	local toks = ctx.toks;
	local j = i;
	local res, ok;

	j, ok = common.parse_op(ctx, j, "(");
	if not ok then return i end

	j, res = exp.parse_exp(ctx, j);
	if not res then error(toks[j].loc, "expected expression") end

	j, ok = common.parse_op(ctx, j, ")");
	if not ok then error(toks[j].loc, "expected ')'" ) end

	return j, res;
end

--- @param ctx parser.ctx
--- @param i integer
--- @param op string
--- @param cl string
function exp.parse_exp_tuple(ctx, i, op, cl)
	local j = i;
	local ok;

	j, ok = parse_op(ctx, j, op);
	if not ok then return i end

	--- @type (node.tuple_member | node.tuple_spread | node.exp)[]
	local members = {};

	j, ok = parse_op(ctx, j, cl);
	if not ok then
		while true do
			local key, val;
			local member_loc = ctx.toks[j].loc;

			j, ok = parse_any_op(ctx, j, { "...", "." });
			if ok == "." then
				j, ok = parse_op(ctx, j, "(");
				if ok then
					j, key = ctx:parse_exp(j);
					if not key then error(ctx.toks[j].loc, "expected expression") end

					j, ok = parse_op(ctx, j, ")");
					if not ok then error(ctx.toks[j].loc, "expected ')'" ) end
				else
					j, key = parse_id(ctx, j);
					if not key then error(ctx.toks[j].loc, "expected identifier or '(exp)'") end
				end

				j, ok = parse_op(ctx, j, "=");
				if not ok then error(ctx.toks[j].loc, "expected '='") end

				j, val = exp.parse_exp(ctx, j);
				if not val then error(ctx.toks[j].loc, "expected expression after '='") end

				table.insert(members, { kind = "tuple_member", loc = member_loc, key = key, val = val } --[[@as node.tuple_member]]);
			else
				j, val = exp.parse_exp(ctx, j);
				if not val then error(ctx.toks[j].loc, "expected expression or `.`") end

				if ok == "..." then
					table.insert(members, { kind = "tuple_spread", loc = member_loc, val = val } --[[@as node.tuple_spread]]);
				else
					table.insert(members, val);
				end
			end

			j, ok = parse_op(ctx, j, cl);
			if ok then break end

			j, ok = parse_any_op(ctx, j, { ",", ";" });
			if not ok then error(ctx.toks[j].loc, "expected '" .. cl .. "', ';' or ',' ") end
		end
	end

	return j, { kind = "tuple", loc = ctx.toks[j].loc, members = members } --[[@as node.tuple]];
end

--- @param ctx parser.ctx
--- @param i integer
function exp.parse_exp_type(ctx, i)
	local j = i;
	local kind, body;

	j, kind = parse_any_op(ctx, j, { "union", "struct" });
	if not kind then return i end

	j, body = parse_struct_body(ctx, j);
	if not body then error(ctx.toks[j].loc, "expected " .. kind .. " body") end

	return j, { kind = kind, loc = ctx.toks[j].loc, fields = body } --[[@as node.struct]];
end

--- @param ctx parser.ctx
--- @param i integer
function exp.parse_exp_func_type(ctx, i)
	local j = i;
	local kind, body;

	j, kind = parse_op(ctx, j, "func");
	if not kind then return i end

	j, body = parse_signature(ctx, j);
	if not body then error(ctx.toks[j].loc, "expected siganture after 'func'") end

	return j, body;
end

--- @param ctx parser.ctx
--- @param i integer
function exp.parse_exp_func(ctx, i)
	local j = i;
	local sig, body;

	j, sig = parse_signature(ctx, j);
	if not sig then return i end

	j, body = ctx:parse_stm(j);
	if not body then error(ctx.toks[j].loc, "expected function body") end

	return j, { kind = "func", loc = ctx.toks[j].loc, body = body, sig = sig } --[[@as node.func]];
end

--- @param ctx parser.ctx
--- @param i integer
--- @param prev node.exp
function exp.parse_exp_call_suffix(ctx, i, prev)
	local j, args = exp.parse_exp_tuple(ctx, i, "(", ")");
	if not args then return i end
	return j, { kind = "call", loc = ctx.toks[i].loc, args = args, func = prev } --[[@as node.call]];
end

--- @param ctx parser.ctx
--- @param i integer
--- @param prev node.exp
function exp.parse_exp_index_suffix(ctx, i, prev)
	local j, args = exp.parse_exp_tuple(ctx, i, "[", "]");
	if not args then return i end
	return j, { kind = "index", loc = ctx.toks[i].loc, args = args, func = prev } --[[@as node.call]];
end

--- @param ctx parser.ctx
--- @param i integer
--- @param prev node.exp
function exp.parse_exp_member_suffix(ctx, i, prev)
	local j = i;
	local name, ok;

	j, ok = parse_op(ctx, j, ".");
	if not ok then return i end

	j, name = parse_id(ctx, j);
	if not name then error(ctx.toks[j].loc, "expected identifier") end

	return j, { kind = "member", loc = ctx.toks[i].loc, key = name, obj = prev } --[[@as node.member]];
end

--- @param ctx parser.ctx
--- @param i integer
--- @return integer, node.exp?
function exp.parse_exp_single(ctx, i)
	local j = i;
	local res;

	j, res = exp.parse_exp_type(ctx, j);
	if res then return j, res end

	j, res = exp.parse_exp_func_type(ctx, j);
	if res then return j, res end

	j, res = exp.parse_exp_func(ctx, j);
	if res then return j, res end

	j, res = exp.parse_exp_parens(ctx, j);
	if res then return j, res end

	if ctx.toks[j].type == "int" then
		return j + 1, { kind = "lit_int", loc = ctx.toks[j].loc, val = ctx.toks[j].val --[[@as integer]], char = false } --[[@as node.int]];
	elseif ctx.toks[j].type == "fl" then
		return j + 1, { kind = "lit_fl", loc = ctx.toks[j].loc, val = ctx.toks[j].val --[[@as number]] } --[[@as node.fl]];
	elseif ctx.toks[j].type == "str" then
		return j + 1, { kind = "lit_str", loc = ctx.toks[j].loc, val = ctx.toks[j].val --[[@as string]] } --[[@as node.str]];
	elseif ctx.toks[j].type == "id" then
		return j + 1, { kind = "var", loc = ctx.toks[j].loc, name = ctx.toks[j].val --[[@as string]] } --[[@as node.var]];
	end

	return i;
end

--- @param ctx parser.ctx
--- @param i integer
--- @param badmask integer
function exp.parse_exp_prefix(ctx, i, badmask)
	local j = i;
	local val, op;

	j, op = parse_any_op(ctx, j, pre_op_map);
	if not op then return i end

	op = pre_op_map[op];
	j, val = exp.parse_exp(ctx, j, badmask | op_precmasks[op]);
	if not val then error(ctx.toks[j].loc, "expected expression") end

	return j, { kind = "op", loc = ctx.toks[i].loc, op = op, args = { val } } --[[@as node.op]];
end

--- @param ctx parser.ctx
--- @param i integer
--- @param a node.exp
--- @param badmask integer
function exp.parse_exp_postfix(ctx, i, a, badmask)
	local j = i;
	local b;

	j, b = exp.parse_exp_call_suffix(ctx, j, a);
	if b then return j, b end

	j, b = exp.parse_exp_index_suffix(ctx, j, a);
	if b then return j, b end

	j, b = exp.parse_exp_member_suffix(ctx, j, a);
	if b then return j, b end

	local bin_j, bin_op = parse_any_op(ctx, j, bin_op_map);
	local post_j, post_op = parse_any_op(ctx, j, post_op_map);
	local ass_j, ass_op = parse_any_op(ctx, j, assign_op_map);

	j = math.max(bin_j, post_j, ass_j);
	if bin_op and bin_j == j then
		j = bin_j;
		local op = bin_op_map[bin_op];
		if (op_precmasks[op] & badmask) ~= 0 then return i end

		j, b = exp.parse_exp(ctx, j, op_precmasks[op] | badmask);
		if not b then error(ctx.toks[j].loc, "expected expression") end
		return j, { kind = "op", loc = ctx.toks[i].loc, op = op, args = { a, b } } --[[@as node.op]];
	end
	if post_op and post_j == j then
		j = post_j;
		local op = post_op_map[post_op];
		if (op_precmasks[op] & badmask) ~= 0 then return i end
		return j, { kind = "op", loc = ctx.toks[i].loc, op = op, args = { a } } --[[@as node.op]];
	end
	if ass_op and ass_j == j then
		j = ass_j;
		local op = assign_op_map[ass_op];
		if (badmask & op_banmasks.ASSIGN) ~= 0 then return i end

		j, b = exp.parse_exp(ctx, j, op_banmasks.ASSIGN | badmask);
		if not b then error(ctx.toks[j].loc, "expected expression") end
		return j, { kind = "assign", loc = ctx.toks[i].loc, op = op, target = a, val = b } --[[@as node.assign]];
	end

	return i;
end

--- @param i integer
--- @param badmask? integer
--- @return integer, node.exp?
function exp.parse_exp(ctx, i, badmask)
	local j = i;
	local res;
	badmask = badmask or 0;

	j, res = exp.parse_exp_prefix(ctx, j, badmask);
	if not res then j, res = exp.parse_exp_single(ctx, j) end
	if not res then return i end

	while true do
		local new;
		j, new = exp.parse_exp_postfix(ctx, j, res, badmask);
		if not new then return j, res end
		res = new;
	end
end

return exp;
