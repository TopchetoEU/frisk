local node = require "bootstrap.util.node";
local err = require "bootstrap.util.err";
local common = require "bootstrap.parser.common";

local error = err.throw;

local stm = {};

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_attribs(ctx, i)
	local j = i;
	local ok;
	local attribs = {};

	while true do
		j, ok = common.parse_op(ctx, j, "@");
		if not ok then break end

		local attrib;
		j, attrib = ctx:parse_exp_parens(j);
		table.insert(attribs, attrib);
	end

	return j, attribs;
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_decl_name(ctx, i)
	local j = i;
	local ok;
	local parts = {};

	while true do
		local part;
		j, part = common.parse_id(ctx, j);
		if not part then
			if #parts == 0 then return i end
			error(ctx.toks[j].loc, "expected an identifier");
		end

		table.insert(parts, part);
		j, ok = common.parse_op(ctx, j, ".");
		if not ok then break end
	end

	return j, parts;
end

--- @param ctx parser.ctx
--- @param i integer
--- @param force_keywords boolean?
--- @param attribs node.exp[]?
function stm.parse_decl(ctx, i, force_keywords, attribs)
	local j = i;
	local kind, ok;
	local parts = {};
	local var, weak, type;

	if not attribs then j, attribs = stm.parse_attribs(ctx, j) end

	j, weak = common.parse_op(ctx, j, "weak");
	j, var = common.parse_op(ctx, j, "var");

	j, kind = common.parse_any_op(ctx, j, { "struct", "union" });
	if kind then
		local name, body;
		j, name = stm.parse_decl_name(ctx, j);
		if not name then error(ctx.toks[j].loc, "expected an identifier after '" .. kind .. "'") end

		j, body = common.parse_struct_body(ctx, j);
		if not body then error(ctx.toks[j].loc, "expected a '" .. kind .. "' body") end

		return j, {
			kind = "decl", loc = ctx.toks[i].loc,
			mut = var ~= nil, weak = weak ~= nil,
			attribs = attribs, parts = { { name = name, add = false, val = body } },
		} --[[@as node.decl]];
	end

	if force_keywords and not var and not weak then return i end

	local test_j = j;
	local test_ok;
	test_j, test_ok = stm.parse_decl_name(ctx, test_j);
	if test_ok then test_j, test_ok = common.parse_any_op(ctx, test_j, { ",", "=", ";", "(", "+=" }); end
	if not test_ok then j, type = ctx:parse_exp_parens(j) end

	while true do
		local name, val;

		j, name = stm.parse_decl_name(ctx, j);
		if not name then error(ctx.toks[j].loc, "expected an identifier") end

		local force_semicolon = true;

		j, ok = common.parse_any_op(ctx, j, { "=", "+=", "+", "(" });
		if not ok or ok == "+" then
			table.insert(parts, { name = name, add = ok == "+" } --[[@as node.decl_part]]);
		elseif ok == "=" or ok == "+=" then
			j, val = ctx:parse_exp_parens(j);
			if not val then error(ctx.toks[j].loc, "expected declaration value") end

			table.insert(parts, { name = name, add = ok == "+=", val = val } --[[@as node.decl_part]]);
		elseif ok == "(" then
			local sig, body;
			local func_loc = ctx.toks[j].loc;

			j, sig = common.parse_signature(ctx, j - 1);
			if not sig then error(ctx.toks[j].loc, "expected signature") end

			j, body = stm.parse_stm(ctx, j);
			if not body then error(ctx.toks[j].loc, "expected function body") end

			table.insert(parts, { name = name, add = true, val = { kind = "func", loc = func_loc, body = body, sig = sig } --[[@as node.func]] } --[[@as node.decl_part]]);
			force_semicolon = false;
		end

		j, ok = common.parse_op(ctx, j, ",");
		if not ok then
			j, ok = common.parse_op(ctx, j, ";");
			if force_semicolon and not ok then error(ctx.toks[j].loc, "expected ';' or ','") end
			break;
		end
	end

	return j, {
		kind = "decl", loc = ctx.toks[i].loc,
		mut = var ~= nil, weak = weak ~= nil,
		type = type, attribs = attribs, parts = parts,
	} --[[@as node.decl]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_block(ctx, i)
	local j = i;
	local res = {};
	local ok;

	j, ok = common.parse_op(ctx, j, "{");
	if not ok then return i end

	while true do
		repeat j, ok = common.parse_op(ctx, j, ";") until not ok;

		j, ok = common.parse_op(ctx, j, "}");
		if ok then break end

		local stm_node;

		j, stm_node = stm.parse_stm(ctx, j);
		if not stm_node then error(ctx.toks[j].loc, "expected a statement") end

		table.insert(res, stm_node);
	end

	return j, { kind = "block", loc = ctx.toks[i].loc, body = res } --[[@as node.block]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_cond(ctx, i)
	local j = i;
	local ok, cond, if_body, else_body;

	j, ok = common.parse_op(ctx, j, "if");
	if not ok then return i end

	j, cond = ctx:parse_exp_parens(j);
	if not cond then error(ctx.toks[j].loc, "expected if condition") end

	j, if_body = stm.parse_stm(ctx, j);
	if not if_body then error(ctx.toks[j].loc, "expected if body") end

	j, ok = common.parse_op(ctx, j, "else");
	if ok then
		j, else_body = stm.parse_stm(ctx, j);
		if not else_body then error(ctx.toks[j].loc, "expected else body") end
	end

	return j, { kind = "cond", loc = ctx.toks[i].loc, cond = cond, if_body = if_body, else_body = else_body } --[[@as node.cond]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_loop(ctx, i)
	local j = i;
	local ok, cond, pre_body, post_body;

	j, ok = common.parse_op(ctx, j, "do");
	if ok then
		j, pre_body = stm.parse_stm(ctx, j);
		if not pre_body then error(ctx.toks[j].loc, "expected do body") end
	end

	j, ok = common.parse_op(ctx, j, "while");
	if ok then
		j, cond = ctx:parse_exp_parens(j);
		if not cond then error(ctx.toks[j].loc, "expected while condition") end

		j, post_body = stm.parse_stm(ctx, j);
		if not post_body then error(ctx.toks[j].loc, "expected while body") end
	end

	if not cond and not pre_body and not post_body then return i end
	return j, { kind = "loop", loc = ctx.toks[i].loc, cond = cond, pre_body = pre_body, post_body = post_body } --[[@as node.loop]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_stm_decl(ctx, i)
	local j = i;
	local ok, res, attribs;

	j, attribs = stm.parse_attribs(ctx, j);
	j, ok = common.parse_op(ctx, j, "let");

	if ok then
		j, res = stm.parse_decl(ctx, j, false, attribs);
		if not res then error(ctx.toks[j].loc, "expected declaration after 'let'") end
	else
		j, res = stm.parse_decl(ctx, j, #attribs == 0, attribs);
		if not res then
			if #attribs > 0 then error(ctx.toks[j].loc, "expected declaration") end
			return i;
		end
	end

	return j, res;
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_stm_exp(ctx, i)
	local j = i;
	local ok, val;

	j, val = ctx:parse_exp_parens(j);
	if not val then return i end

	j, ok = common.parse_op(ctx, j, ";");
	if not ok then error(ctx.toks[j].loc, "expected ';' after expression") end

	return j, val;
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_for(ctx, i)
	local j = i;
	local ok, init, cond, update, body;

	j, ok = common.parse_op(ctx, j, "for");
	if not ok then return i end

	j, ok = common.parse_op(ctx, j, "(");
	if not ok then error(ctx.toks[j].loc, "expected '(' after 'for'") end

	j, ok = common.parse_op(ctx, j, ";");
	if not ok then
		j, init = stm.parse_stm_decl(ctx, j);
		if not init then j, init = ctx:parse_exp(j) end
		if not init then error(ctx.toks[j].loc, "expected declaration statement, expression or ';'") end
	end

	j, ok = common.parse_op(ctx, j, ";");
	if not ok then
		j, cond = stm.parse_stm_exp(ctx, j);
		if not cond then error(ctx.toks[j].loc, "expected expression or ';'") end
	end

	j, ok = common.parse_op(ctx, j, ")");
	if not ok then
		j, update = ctx:parse_exp(j);
		if not update then error(ctx.toks[j].loc, "expected expression or ')'" ) end
	end

	j, body = stm.parse_stm(ctx, j);
	if not body then error(ctx.toks[j].loc, "expected for body") end

	return j, { kind = "for", loc = ctx.toks[i].loc, init = init, cond = cond, update = update, body = body } --[[@as node.for]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_return(ctx, i)
	local j = i;
	local ok, val;

	j, ok = common.parse_op(ctx, j, "return");
	if not ok then return i end

	j, val = ctx:parse_exp(j);
	j, ok = common.parse_op(ctx, j, ";");

	if not ok then
		if val then error(ctx.toks[j].loc, "expected ';'")
		else error(ctx.toks[j].loc, "expected an expression or ';'") end
	end

	return j, { kind = "return", loc = ctx.toks[i].loc, val = val } --[[@as node.return]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_break(ctx, i)
	local j = i;
	local ok;

	j, ok = common.parse_op(ctx, j, "break");
	if not ok then return i end

	j, ok = common.parse_op(ctx, j, ";");
	if not ok then error(ctx.toks[j].loc, "expected ';'") end

	return j, { kind = "break", loc = ctx.toks[i].loc } --[[@as node.break]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_continue(ctx, i)
	local j = i;
	local ok;

	j, ok = common.parse_op(ctx, j, "continue");
	if not ok then return i end

	j, ok = common.parse_op(ctx, j, ";");
	if not ok then error(ctx.toks[j].loc, "expected ';'") end

	return j, { kind = "continue", loc = ctx.toks[i].loc } --[[@as node.continue]];
end

--- @param ctx parser.ctx
--- @param i integer
function stm.parse_export(ctx, i)
	local j = i;
	local ok, attribs, decl;

	j, attribs = stm.parse_attribs(ctx, j);

	j, ok = common.parse_op(ctx, j, "export");
	if not ok then return i end

	j, decl = stm.parse_decl(ctx, j, false, attribs);
	if not decl then error(ctx.toks[j].loc, "expected declataion after 'export'") end

	return j, { kind = "export", loc = ctx.toks[j].loc, decl = decl } --[[@as node.export]];
end

--- @param ctx parser.ctx
--- @param i integer
--- @param with_export boolean?
--- @return integer, node.stm?
function stm.parse_stm(ctx, i, with_export)
	local j = i;
	local res;
	j, res = stm.parse_cond(ctx, j); if res then return j, res end
	j, res = stm.parse_loop(ctx, j); if res then return j, res end
	j, res = stm.parse_for(ctx, j); if res then return j, res end
	j, res = stm.parse_return(ctx, j); if res then return j, res end
	j, res = stm.parse_break(ctx, j); if res then return j, res end
	j, res = stm.parse_continue(ctx, j); if res then return j, res end
	j, res = stm.parse_block(ctx, j); if res then return j, res end
	if with_export then
		j, res = stm.parse_export(ctx, j); if res then return j, res end
	end
	j, res = stm.parse_stm_decl(ctx, j); if res then return j, res end
	j, res = stm.parse_stm_exp(ctx, j); if res then return j, res end
	return i;
end

return stm;
