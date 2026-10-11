local lex = require "bootstrap.lexer";
local common = require "bootstrap.parser.common";
local exp_parsers = require "bootstrap.parser.exp";
local stm_parsers = require "bootstrap.parser.stm";
local err = require "bootstrap.util.err";

local error = err.throw;

--- @param toks lex.tok[] | string
--- @param filename string
return function(toks, filename)
	if type(toks) == "string" then
		toks = lex.parse(toks, filename);
	end

	--- @type parser.ctx
	local ctx = {
		toks = toks,
		parse_exp = exp_parsers.parse_exp,
		parse_stm = stm_parsers.parse_stm,
		parse_exp_parens = exp_parsers.parse_exp_parens,
	};

	local i = 1;
	--- @type node.decl[]
	local res = {};

	while true do
		local ok;
		repeat i, ok = common.parse_op(ctx, i, ";") until not ok;
		if toks[i].type == "eof" then break end

		local stm;
		i, stm = stm_parsers.parse_stm(ctx, i, true);
		if not stm then error(toks[i].loc, "unexpected syntax") end

		table.insert(res, stm);
	end

	return res;
end
