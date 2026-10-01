local lex = require "bootstrap.lexer";
local node = require "bootstrap.util.node";
local err = require "bootstrap.util.err";

local error = err.throw;

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

	-- ["!"] = node.ops.ASSERT,
	-- ["?"] = node.ops.TRY,
	-- ["else"] = node.ops.ASSERT,
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

--- @class syntax.local
--- @field type "local"
--- @field name string


local parse_stm;
local parse_exp, parse_exp_parens;

--- @param toks lex.tok[]
--- @param i integer
local function parse_id(toks, i)
	local j = i;

	if toks[j].type ~= "id" then return i end
	return j + 1, toks[j].val --[[@as string]];
end

--- @param toks lex.tok[]
--- @param i integer
--- @param val? string
--- @return integer, string?
local function parse_op(toks, i, val)
	if toks[i].type == "id" then
		if not val then return i + 1, val end
		if val == toks[i].val then return i + 1, val end
	end

	if toks[i].type == "op" then
		if not val then return i + #toks[i].val, toks[i].val --[[@as string]] end
		if toks[i].val:sub(1, #val) == val then return i + #val, val end
	end

	return i;
end

--- @param ops table<string> | string[]
local function parse_any_op(toks, i, ops)
	local max_j, max_res = i, nil;

	for _, op in ipairs(ops) do
		local j, res = parse_op(toks, i, op);
		if j > max_j then max_j, max_res = j, res end
	end
	for op in pairs(ops) do
		if type(op) == "string" then
			local j, res = parse_op(toks, i, op);
			if j > max_j then max_j, max_res = j, res end
		end
	end

	return max_j, max_res;
end

------------ EXPRESSIONS ------------

local function parse_signature(toks, i)
	local j = i;
	local params = {};
	local spread_param, ret, ok;

	j, ok = parse_op(toks, j, "(");
	if not ok then return i end

	j, ok = parse_op(toks, j, ")");
	if not ok then
		while true do
			local spread, generic, kind, type, name;

			j, generic = parse_op(toks, j, "generic");
			j, kind = parse_any_op(toks, j, { "ref", "own" });
			j, spread = parse_op(toks, j, "...");

			j, type = parse_exp(toks, j);
			if not type then return i, nil end

			j, name = parse_id(toks, j);

			--- @type node.parameter
			local param = {
				name = name,
				type = type,
				kind = kind,
				generic = generic and true or false,
			}

			if spread then
				j, ok = parse_op(toks, j, ")");
				if not ok then error(toks[i].loc, "spread parameter must be last") end

				spread_param = param;
				break;
			end

			table.insert(params, param);

			j, ok = parse_op(toks, j, ")");
			if ok then break end

			j, ok = parse_op(toks, j, ",");
			if not ok then return i end
		end
	end

	j, ret = parse_exp(toks, j);
	if not ret then return i end

	return j, { kind = "signature", params = params, spread = spread_param, ret = ret } --[[@as node.signature]];
end
local function parse_exp_func(toks, i)
	local j = i;
	local sig, body;

	j, sig = parse_signature(toks, j);
	if not sig then return i end

	j, body = parse_stm(toks, j);
	if not body then error(toks[j].loc, "expected function body") end

	return j, { kind = "func", loc = toks[j].loc, body = body, sig = sig } --[[@as node.func]];
end
local function parse_struct_body(toks, i)
	local j = i;
	local fields = {};
	local ok;

	j, ok = parse_op(toks, j, "{");
	if not ok then return i end

	while true do
		repeat j, ok = parse_op(toks, j, ";") until not ok;

		j, ok = parse_op(toks, j, "}");
		if ok then break end

		local name, type;

		j, type = parse_exp(toks, j);
		if not type then error(toks[j].loc, "expected member type") end

		j, ok = parse_op(toks, j, ";");
		if ok then
			table.insert(fields, { loc = toks[j - 1].loc, type = type } --[[@as node.struct_member]]);
		else
			while true do
				local field_i = j;

				j, name = parse_id(toks, j);
				if not name then error(toks[j].loc, "expected member name or ';'") end

				table.insert(fields, { loc = toks[field_i].loc, type = type, name = name } --[[@as node.struct_member]]);

				j, ok = parse_op(toks, j, ";");
				if ok then break end

				j, ok = parse_op(toks, j, ",");
				if not ok then error(toks[j].loc, "expected ',' or ';'") end
			end
		end
	end

	return j, fields;
end

--- @param i integer
--- @return integer, node.tuple?
local function parse_exp_tuple(toks, i, op, cl)
	local j = i;
	local ok;

	j, ok = parse_op(toks, j, op);
	if not ok then return i end

	--- @type (node.tuple_member | node.tuple_spread | node.exp)[]
	local members = {};

	j, ok = parse_op(toks, j, cl);
	if not ok then
		while true do
			local key, val;
			local member_loc = toks[j].loc;

			j, ok = parse_any_op(toks, j, { "...", "." });
			if ok == "." then
				j, ok = parse_op(toks, j, "(");
				if ok then
					j, key = parse_exp(toks, j);
					if not key then error(toks[j], "expected expression") end

					j, ok = parse_op(toks, j, ")");
					if not ok then error(toks[j], "expected ')'") end
				else
					j, key = parse_id(toks, j);
					if not key then error(toks[j], "expected identifier or '(exp)'") end
				end

				j, ok = parse_op(toks, j, "=");
				if not val then error(toks[j], "expected '='") end

				j, val = parse_exp(toks, j);
				if not val then error(toks[j], "expected expression after '='") end

				table.insert(members, { kind = "tuple_member", loc = member_loc, key = key, val = val, } --[[@as node.tuple_member]])
			else
				j, val = parse_exp(toks, j);
				if not val then error(toks[j], "expected expression or `.`") end

				if ok == "..." then
					table.insert(members, { kind = "tuple_spread", loc = member_loc, val = val, } --[[@as node.tuple_spread]]);
				else
					table.insert(members, val);
				end
			end

			j, ok = parse_op(toks, j, cl);
			if ok then break end

			j, ok = parse_any_op(toks, j, { ",", ";" });
			if not ok then error(toks[j], "expected '" .. cl .. "', ';' or ',' ") end
		end
	end

	return j, { kind = "tuple", loc = toks[j].loc, members = members } --[[@as node.tuple]];
end
local function parse_exp_type(toks, i, badmask)
	local j = i;
	local kind, body;

	j, kind = parse_any_op(toks, j, { "union", "struct" });
	if not kind then return i end

	j, body = parse_struct_body(toks, j);
	if not body then error(toks[j].loc, "expected " .. kind .. " body") end

	return j, { kind = "struct", loc = toks[j].loc, fields = body } --[[@as node.struct]];
end
local function parse_exp_func_type(toks, i, badmask)
	local j = i;
	local kind, body;

	j, kind = parse_op(toks, j, "func");
	if not kind then return i end

	j, body = parse_signature(toks, j);
	if not body then error(toks[j].loc, "expected siganture after 'func'") end

	return j, body;
end

local function parse_exp_call_suffix(toks, i, prev, badmask)
	local j = i;
	local args;

	j, args = parse_exp_tuple(toks, j, "(", ")");
	if not args then return i end

	return j, { kind = "call", loc = toks[i].loc, args = args, func = prev } --[[@as node.call]];
end
local function parse_exp_index_suffix(toks, i, prev, badmask)
	local j = i;
	local args;

	j, args = parse_exp_tuple(toks, j, "[", "]");
	if not args then return i end

	return j, { kind = "index", loc = toks[i].loc, args = args, func = prev } --[[@as node.call]];
end
local function parse_exp_member_suffix(toks, i, prev, badmask)
	local j = i;
	local name, ok;

	j, ok = parse_op(toks, j, ".");
	if not ok then return i end

	j, name = parse_id(toks, j);
	if not name then error(toks[j].loc, "expected identifier") end

	return j, { kind = "member", loc = toks[i].loc, key = name, obj = prev } --[[@as node.member]];
end
function parse_exp_parens(toks, i)
	local j = i;
	local res, ok;

	j, ok = parse_op(toks, j, "(");
	if not ok then return i end

	j, res = parse_exp(toks, j);
	if not res then error(toks[j].loc, "expected expression") end

	j, ok = parse_op(toks, j, ")");
	if not ok then error(toks[j].loc, "expected ')'") end

	return j, res;
end
local function parse_exp_single(toks, i, badmask)
	local j = i;
	local res;

	j, res = parse_exp_type(toks, j);
	if res then return j, res end

	j, res = parse_exp_func_type(toks, j);
	if res then return j, res end

	j, res = parse_exp_func(toks, j);
	if res then return j, res end

	j, res = parse_exp_parens(toks, j);
	if res then return j, res end

	if toks[j].type == "int" then
		return j + 1, { kind = "lit_int", loc = toks[j].loc, val = toks[j].val --[[@as integer]], char = false } --[[@as node.int]];
	elseif toks[j].type == "fl" then
		return j + 1, { kind = "lit_fl", loc = toks[j].loc, val = toks[j].val --[[@as number]] } --[[@as node.fl]];
	elseif toks[j].type == "str" then
		return j + 1, { kind = "lit_str", loc = toks[j].loc, val = toks[j].val --[[@as string]] } --[[@as node.str]];
	elseif toks[j].type == "id" then
		return j + 1, { kind = "var", loc = toks[j].loc, name = toks[j].val --[[@as string]] } --[[@as node.var]];
	end

	return i;
end
local function parse_exp_prefix(toks, i, badmask)
	local j = i;
	local val, op;

	j, op = parse_any_op(toks, j, pre_op_map);
	if not op then return i end

	local op = pre_op_map[op];

	j, val = parse_exp(toks, j, badmask | op_precmasks[op]);
	if not val then error(toks[j], "expected expression") end

	return j, { kind = "op", loc = toks[i].loc, op = op, args = { val } } --[[@as node.op]];
end
local function parse_exp_postfix(toks, i, a, badmask)
	local j = i;
	local b;

	j, b = parse_exp_call_suffix(toks, j, a, badmask);
	if b then return j, b end

	j, b = parse_exp_index_suffix(toks, j, a, badmask);
	if b then return j, b end

	j, b = parse_exp_member_suffix(toks, j, a, badmask);
	if b then return j, b end

	local bin_j, bin_op = parse_any_op(toks, j, bin_op_map);
	local post_j, post_op = parse_any_op(toks, j, post_op_map);
	local ass_j, ass_op = parse_any_op(toks, j, assign_op_map);

	j = math.max(bin_j, post_j, ass_j);
	if bin_op and bin_j == j then
		j = bin_j;

		local op = bin_op_map[bin_op];
		if (op_precmasks[op] & badmask) ~= 0 then return i end

		j, b = parse_exp(toks, j, op_precmasks[op] | badmask);
		if not b then error(toks[j].loc, "expected expression") end

		return j, { kind = "op", loc = toks[i].loc, op = op, args = { a, b } } --[[@as node.op]];
	end
	if post_op and post_j == j then
		j = post_j;
		local op = post_op_map[post_op];
		if (op_precmasks[op] & badmask) ~= 0 then return i end

		return j, { kind = "op", loc = toks[i].loc, op = op, args = { a } } --[[@as node.op]];
	end
	if ass_op and ass_j == j then
		j = ass_j;
		local op = assign_op_map[ass_op];
		if (badmask & op_banmasks.ASSIGN) ~= 0 then return i end

		j, b = parse_exp(toks, j, op_banmasks.ASSIGN | badmask);
		if not b then error(toks[j].loc, "expected expression") end

		return j, { kind = "assign", loc = toks[i].loc, op = op, target = a, val = b } --[[@as node.assign]];
	end

	return i;
end

--- @param toks lex.tok[]
--- @param i integer
--- @param badmask? integer
--- @return integer
--- @return node.exp?
function parse_exp(toks, i, badmask)
	local j = i;
	local res;

	j, res = parse_exp_prefix(toks, j, badmask or 0);
	if not res then
		j, res = parse_exp_single(toks, j, badmask or 0);
	end
	if not res then return i end

	while true do
		local new;

		j, new = parse_exp_postfix(toks, j, res, badmask or 0);
		if not new then return j, res end

		res = new;
	end
end

------------ STATEMENTS ------------

-- local function parse_stm_end(toks, i)
-- 	return parse_op(toks, i, ";");
-- end

local function parse_attribs(toks, i)
	local j = i;

	local ok;
	local attribs = {};

	while true do
		j, ok = parse_op(toks, j, "@");
		if not ok then break end

		local attrib;
		j, attrib = parse_exp(toks, j);
		table.insert(attribs, attrib);
	end

	return j, attribs;

end
local function parse_decl_name(toks, i)
	local j = i;
	local ok;
	local parts = {};

	while true do
		local part;

		j, part = parse_id(toks, j);
		if not part then
			if #parts == 0 then return i end
			error(toks[j].loc, "expected an identifier");
		end

		table.insert(parts, part);

		j, ok = parse_op(toks, j, ".");
		if not ok then break end
	end

	if #parts == 0 then return i end

	return j, parts;
end
local function parse_decl(toks, i, force_keywords, attribs)
	local j = i;

	local kind, ok;

	local parts = {};
	local var, weak, type;

	if not attribs then j, attribs = parse_attribs(toks, j) end

	j, weak = parse_op(toks, j, "weak");
	j, var = parse_op(toks, j, "var");

	j, kind = parse_any_op(toks, j, { "struct", "union" });
	if kind then
		local name, body;

		j, name = parse_decl_name(toks, j);
		if not name then error(toks[j].loc, "expected an identifier after '" + kind + "'") end

		j, body = parse_struct_body(toks, j);
		if not body then error(toks[j].loc, "expected a '" + kind + "' body") end

		return j, {
			kind = "decl", loc = toks[i].loc,
			mut = var ~= nil, weak = weak ~= nil,
			attribs = attribs, parts = { { name = name, add = false, val = body } },
		} --[[@as node.decl]];
	end

	if force_keywords and not var and not weak then return i end

	local test_j = j;
	local test_ok;

	test_j, test_ok = parse_decl_name(toks, test_j);
	if test_ok then
		test_j, test_ok = parse_any_op(toks, test_j, { ",", "=", ";", "(", "+=" });
	end

	if not test_ok then
		j, type = parse_exp(toks, j);
	end

	while true do
		local name, val;
		j, name = parse_decl_name(toks, j);
		if not name then
			error(toks[j].loc, "expected an identifier");
		end

		local force_semicolon = true;

		j, ok = parse_any_op(toks, j, { "=", "+=", "+", "(" });
		if not ok or ok == "+" then
			table.insert(parts, { name = name, add = ok == "+" } --[[@as node.decl_part]]);
		elseif ok == "=" or ok == "+=" then
			j, val = parse_exp(toks, j);
			if not val then error(toks[j].loc, "expected declaration value") end

			table.insert(parts, { name = name, add = ok == "+=", val = val } --[[@as node.decl_part]]);
		elseif ok == "(" then
			local sig, body;
			local func_loc = toks[j].loc;

			j, sig = parse_signature(toks, j - 1);
			if not sig then error(toks[j].loc, "expected signature") end

			j, body = parse_stm(toks, j);
			if not body then error(toks[j].loc, "expected function body") end

			table.insert(parts, { name = name, add = true, val = { kind = "func", loc = func_loc, body = body, sig = sig } --[[@as node.func]] } --[[@as node.decl_part]]);

			force_semicolon = false;
		end

		j, ok = parse_op(toks, j, ",");
		if not ok then
			j, ok = parse_op(toks, j, ";");
			if force_semicolon and not ok then
				error(toks[j].loc, "expected ';' or ','");
			end
			break;
		end
	end

	return j, {
		kind = "decl", loc = toks[i].loc,
		mut = var ~= nil, weak = weak ~= nil,
		type = type, attribs = attribs, parts = parts
	} --[[@as node.decl]];
end
local function parse_block(toks, i)
	local j = i;

	local res = {};
	local ok;

	j, ok = parse_op(toks, j, "{");
	if not ok then return i end

	while true do
		repeat j, ok = parse_op(toks, j, ";") until not ok;

		j, ok = parse_op(toks, j, "}");
		if ok then break end

		local stm;
		j, stm = parse_stm(toks, j);
		if not stm then error(toks[j].loc, "expected a statement") end

		table.insert(res, stm);
	end

	return j, { kind = "block", loc = toks[i].loc, body = res } --[[@as node.block]];
end
local function parse_cond(toks, i)
	local j = i;

	local ok, cond, if_body, else_body;

	j, ok = parse_op(toks, j, "if");
	if not ok then return i end

	j, cond = parse_exp_parens(toks, j);
	if not cond then error(toks[j].loc, "expected if condition") end

	j, if_body = parse_stm(toks, j);
	if not if_body then error(toks[j].loc, "expected if body") end

	j, ok = parse_op(toks, j, "else");
	if ok then
		j, else_body = parse_stm(toks, j);
		if not else_body then error(toks[j].loc, "expected else body") end
	end

	return j, { kind = "cond", loc = toks[i].loc, cond = cond, if_body = if_body, else_body = else_body } --[[@as node.cond]];
end
local function parse_loop(toks, i)
	local j = i;

	local ok, cond, pre_body, post_body;

	j, ok = parse_op(toks, j, "do");
	if ok then
		j, pre_body = parse_stm(toks, j);
		if not pre_body then error(toks[j].loc, "expected do body") end
	end

	j, ok = parse_op(toks, j, "while");
	if ok then
		j, cond = parse_exp_parens(toks, j);
		if not cond then error(toks[j].loc, "expected while condition") end

		j, post_body = parse_stm(toks, j);
		if not post_body then error(toks[j].loc, "expected while body") end
	end

	if not cond and not pre_body and not post_body then return i end

	return j, { kind = "loop", loc = toks[i].loc, cond = cond, pre_body = pre_body, post_body = post_body } --[[@as node.loop]];
end
local function parse_stm_decl(toks, i)
	local j = i;
	local ok, res, attribs;

	if not attribs then j, attribs = parse_attribs(toks, j) end

	j, ok = parse_op(toks, j, "let");
	if ok then
		j, res = parse_decl(toks, j, false, attribs);
		if not res then error(toks[j].loc, "expected declaration after 'let'") end
	else
		j, res = parse_decl(toks, j, #attribs == 0, attribs);
		if not res then
			if #attribs > 0 then error(toks[j].loc, "expected declaration") end
			return i;
		end
	end

	return j, res;
end
local function parse_stm_exp(toks, i)
	local j = i;
	local ok, val;

	j, val = parse_exp(toks, j);
	if not val then return i end

	j, ok = parse_op(toks, j, ";");
	if not ok then error(toks[j].loc, "expected ';' after expression") end

	return j, val;
end
local function parse_for(toks, i)
	local j = i;

	local ok, init, cond, update, body;

	j, ok = parse_op(toks, j, "for");
	if not ok then return i end

	j, ok = parse_op(toks, j, "(");
	if not ok then error(toks[j].loc, "expected '(' after 'for'") end

	j, ok = parse_op(toks, j, ";");
	if not ok then
		j, init = parse_stm_decl(toks, j);
		if not init then
			j, init = parse_exp(toks, j);
		end
		if not init then error(toks[j].loc, "expected declaration statement, expression or ';'") end
	end

	j, ok = parse_op(toks, j, ";");
	if not ok then
		j, cond = parse_stm_exp(toks, j);
		if not cond then error(toks[j].loc, "expected expression or ';'") end
	end

	j, ok = parse_op(toks, j, ")");
	if not ok then
		j, update = parse_exp(toks, j);
		if not update then error(toks[j].loc, "expected expression or ')'") end
	end

	j, body = parse_stm(toks, j);
	if not body then error(toks[j].loc, "expected for body") end

	return j, { kind = "for", loc = toks[i].loc, init = init, cond = cond, update = update, body = body } --[[@as node.for]];
end
local function parse_return(toks, i)
	local j = i;
	local ok, val;

	j, ok = parse_op(toks, j, "return");
	if not ok then return i end

	j, val = parse_exp(toks, j);

	j, ok = parse_op(toks, j, ";");
	if not ok then
		if val then
			error(toks[j].loc, "expected ';'");
		else
			error(toks[j].loc, "expected an expression or ';'");
		end
	end

	return j, { kind = "return", loc = toks[i].loc, val = val } --[[@as node.return]];
end
local function parse_break(toks, i)
	local j = i;
	local ok;

	j, ok = parse_op(toks, j, "break");
	if not ok then return i end

	j, ok = parse_op(toks, j, ";");
	if not ok then error(toks[j].loc, "expected ';'") end

	return j, { kind = "break", loc = toks[i].loc } --[[@as node.break]];
end
local function parse_continue(toks, i)
	local j = i;
	local ok;

	j, ok = parse_op(toks, j, "continue");
	if not ok then return i end

	j, ok = parse_op(toks, j, ";");
	if not ok then error(toks[j].loc, "expected ';'") end

	return j, { kind = "continue", loc = toks[i].loc } --[[@as node.continue]];
end
local function parse_export(toks, i)
	local j = i;
	local ok, attribs, decl;

	j, attribs = parse_attribs(toks, j);

	j, ok = parse_op(toks, j, "export");
	if not ok then return i end

	j, decl = parse_decl(toks, j, false, attribs);
	if not decl then error(toks[j].loc, "expected declataion after 'export'") end

	return j, { kind = "export", loc = toks[j].loc, decl = decl } --[[@as node.export]];

end

--- @param toks lex.tok[]
--- @param i integer
function parse_stm(toks, i, with_export)
	local j = i;
	local res;

	j, res = parse_cond(toks, i);
	if res then return j, res end

	j, res = parse_loop(toks, i);
	if res then return j, res end

	j, res = parse_for(toks, i);
	if res then return j, res end

	j, res = parse_return(toks, i);
	if res then return j, res end

	j, res = parse_break(toks, i);
	if res then return j, res end

	j, res = parse_break(toks, i);
	if res then return j, res end

	j, res = parse_continue(toks, i);
	if res then return j, res end

	j, res = parse_block(toks, i);
	if res then return j, res end

	if with_export then
		j, res = parse_export(toks, i);
		if res then return j, res end
	end

	j, res = parse_stm_decl(toks, i);
	if res then return j, res end

	j, res = parse_stm_exp(toks, i);
	if res then return j, res end

	return i;
end

------------ DECLARATIONS ------------

--- @param toks lex.tok[] | string
--- @param filename string
return function (toks, filename)
	if type(toks) == "string" then
		toks = lex.parse(toks, filename);
	end

	local i = 1;
	--- @type node.decl[]
	local res = {};

	while true do
		local ok;
		repeat i, ok = parse_op(toks, i, ";") until not ok;
		if toks[i].type == "eof" then break end

		local stm;
		i, stm = parse_stm(toks, i, true);
		if not stm then error(toks[i].loc, "unexpected syntax") end

		table.insert(res, stm);
	end

	return res;
end
