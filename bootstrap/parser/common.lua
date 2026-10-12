local err = require "bootstrap.util.err";
local error = err.throw;

--- @class parser.ctx
--- @field toks lex.tok[]
--- @field parse_exp fun(ctx: parser.ctx, i: integer, badmask?: integer): integer, node.exp?
--- @field parse_exp_parens fun(ctx: parser.ctx, i: integer): integer, node.exp?
--- @field parse_stm fun(ctx: parser.ctx, i: integer, force_keywords?: boolean): integer, node.stm?

local common = {};

--- @param ctx parser.ctx
--- @param i integer
function common.parse_id(ctx, i)
	if ctx.toks[i].type ~= "id" then return i end
	return i + 1, ctx.toks[i].val --[[@as string]];
end
--- @param ctx parser.ctx
--- @param i integer
--- @param val? string
--- @return integer, string?
function common.parse_op(ctx, i, val)
	if ctx.toks[i].type == "id" then
		if not val then return i + 1, val end
		if val == ctx.toks[i].val then return i + 1, val end
	end

	if ctx.toks[i].type == "op" then
		if not val then return i + #ctx.toks[i].val, ctx.toks[i].val --[[@as string]] end
		if ctx.toks[i].val:sub(1, #val) == val then return i + #val, val end
	end

	return i;
end
--- @param ctx parser.ctx
--- @param i integer
--- @param ops table<string> | string[]
function common.parse_any_op(ctx, i, ops)
	local max_j, max_res = i, nil;

	for _, op in ipairs(ops) do
		local j, res = common.parse_op(ctx, i, op);
		if j > max_j then max_j, max_res = j, res end
	end
	for op in pairs(ops) do
		if type(op) == "string" then
			local j, res = common.parse_op(ctx, i, op);
			if j > max_j then max_j, max_res = j, res end
		end
	end

	return max_j, max_res;
end

--- @param ctx parser.ctx
--- @param i integer
function common.parse_signature(ctx, i)
	local j = i;
	local params = {};
	local spread_param, ret, ok;

	j, ok = common.parse_op(ctx, j, "(");
	if not ok then return i end

	j, ok = common.parse_op(ctx, j, ")");
	if not ok then
		while true do
			local spread, generic, kind, type, name;

			j, generic = common.parse_op(ctx, j, "generic");
			j, kind = common.parse_any_op(ctx, j, { "ref", "own" });
			j, spread = common.parse_op(ctx, j, "...");

			j, type = ctx:parse_exp(j);
			if not type then return i, nil end

			j, name = common.parse_id(ctx, j);

			--- @type node.parameter
			local param = {
				name = name,
				type = type,
				kind = kind,
				generic = generic and true or false,
			}

			if spread then
				j, ok = common.parse_op(ctx, j, ")");
				if not ok then error(ctx.toks[i].loc, "spread parameter must be last") end

				spread_param = param;
				break;
			end

			table.insert(params, param);

			j, ok = common.parse_op(ctx, j, ")");
			if ok then break end

			j, ok = common.parse_op(ctx, j, ",");
			if not ok then return i end
		end
	end

	j, ret = ctx:parse_exp(j);
	if not ret then return i end

	return j, { kind = "signature", params = params, spread = spread_param, ret = ret } --[[@as node.signature]];
end
--- @param ctx parser.ctx
--- @param i integer
function common.parse_struct_body(ctx, i)
	local j = i;
	local fields = {};
	local ok;

	j, ok = common.parse_op(ctx, j, "{");
	if not ok then return i end

	while true do
		repeat j, ok = common.parse_op(ctx, j, ";") until not ok;

		j, ok = common.parse_op(ctx, j, "}");
		if ok then break end

		local name, type;

		j, type = ctx:parse_exp(j);
		if not type then error(ctx.toks[j].loc, "expected member type") end

		j, ok = common.parse_op(ctx, j, ";");
		if ok then
			table.insert(fields, { loc = ctx.toks[j - 1].loc, type = type } --[[@as node.struct_member]]);
		else
			while true do
				local field_i = j;

				j, name = common.parse_id(ctx, j);
				if not name then error(ctx.toks[j].loc, "expected member name or ';'") end

				table.insert(fields, { loc = ctx.toks[field_i].loc, type = type, name = name } --[[@as node.struct_member]]);

				j, ok = common.parse_op(ctx, j, ";");
				if ok then break end

				j, ok = common.parse_op(ctx, j, ",");
				if not ok then error(ctx.toks[j].loc, "expected ',' or ';'") end
			end
		end
	end

	return j, fields;
end

return common;
