local node = require "bootstrap.util.node";
local err = require "bootstrap.util.err";
local error = err.throw;
local lexer = {};

local operators = {
	"**=", "+=", "-=", "*=", "/=", "%=", "..=", "=",
	"|=", "&=", "^=", ">>=", "<<=",
	"&&=", "||=",

	"**", "+", "-", "*", "/", "%", "..",
	"|", "&", "^", "~", "<<", ">>",
	"&&", "||", "!",

	"!=", "==", ">=", "<=", ">", "<",

	",", ".", ";", ":", "...",
	"(", ")", "[", "]", "{", "}", "@", "?",
};

local op_map = {};
for _, op in ipairs(operators) do
	op_map[op] = true;
end

--- @class lex.str: lex.tok_base
--- @field type 'str'
--- @field val string

--- @class lex.int: lex.tok_base
--- @field type 'int'
--- @field val integer
--- @field char boolean

--- @class lex.fl: lex.tok_base
--- @field type 'fl'
--- @field val number

--- @class lex.op: lex.tok_base
--- @field type 'op'
--- @field val string
--- @field n integer

--- @class lex.id: lex.tok_base
--- @field type 'id'
--- @field val string

--- @class lex.eof: lex.tok_base
--- @field type 'eof'

--- @alias lex.tok lex.str | lex.int | lex.fl | lex.op | lex.id | lex.eof

--- @class lex.tok_base
--- @field loc node.loc

--- @class lex.ctx
--- @field lines integer[]
--- @field src string
--- @field fname string

--- @param ctx lex.ctx
--- @param i integer
local function find_loc(ctx, i)
	local low = 1;
	local high = #ctx.lines;
	local line = 1;

	while low <= high do
		local mid = math.floor((low + high) / 2)
		if ctx.lines[mid] < i then
			line = mid; -- mid is a candidate
			low = mid + 1; -- try to find a larger one
		else
			high = mid - 1; -- need smaller values
		end
	end

	local col = i - ctx.lines[line];
	return node.loc(ctx.fname, line, col);
end

--- @param ctx lex.ctx
--- @param i integer
--- @return integer, true?
local function skip_comment(ctx, i)
	local j = ctx.src:match("^//()", i);
	if not j then return i end

	local n_i = ctx.src:match("\n()", j);
	if not n_i then
		n_i = #ctx.src + 1;
	end

	return n_i, true;
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, true?
local function skip_long_comment(ctx, i)
	local j = ctx.src:match("^/%*()", i);
	if not j then return i end

	local n_i = ctx.src:match("%*/()", j);
	if not n_i then
		n_i = #ctx.src + 1;
	end

	return n_i, true;
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, string?
local function skip_white(ctx, i)
	if i == 1 then
		local j = ctx.src:match "^#!.-\n()";
		if j then i = j end
	end

	while true do
		local _, n_i = ctx.src:find("^%s+", i);
		if n_i then i = n_i + 1 end

		local c_i, msg1 = skip_comment(ctx, i);
		if msg1 then i = c_i end

		local c_i, msg2 = skip_long_comment(ctx, i);
		if msg2 then i = c_i end

		if not n_i and not msg1 and not msg2 then return i end
	end
end

--- @param ctx lex.ctx
--- @param i integer
--- @return integer, string?
local function parse_longlit(ctx, i)
	local _, res, j = ctx.src:match("^%[(=-)%[(.-)%]%1%]()", i);
	if not _ then return i end
	return j, res;
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, string
local function parse_escape_char(ctx, i)
	if ctx.src:match("^a", i) then
		return i + 1, "\a";
	elseif ctx.src:match("^b", i) then
		return i + 1, "\b";
	elseif ctx.src:match("^f", i) then
		return i + 1, "\f";
	elseif ctx.src:match("^n", i) then
		return i + 1, "\n";
	elseif ctx.src:match("^r", i) then
		return i + 1, "\r";
	elseif ctx.src:match("^t", i) then
		return i + 1, "\t";
	elseif ctx.src:match("^v", i) then
		return i + 1, "\v";
	elseif ctx.src:match("^n", i) then
		return ctx.src:match("^%s*()", i), "";
	elseif ctx.src:match("^x", i) then
		local val, j = ctx.src:match("^x([0-9a-fA-F][0-9a-fA-F])()", i);
		if not val then error(find_loc(ctx, j), "invalid \\x escape sequence") end
		return j, string.char(tonumber(val, 16));
	else
		local c = ctx.src:match("^.", i);
		if not c then error(find_loc(ctx, i), "unterminated string literal") end
		return i + 1, c;
	end
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, string?
local function parse_string(ctx, i)
	local j, longlit = parse_longlit(ctx, i);
	if longlit then return j, longlit end

	local quote = ctx.src:match("^[\'\"]", j);
	if not quote then return i end

	j = j + 1;

	local parts = {};

	while true do
		local part, p_i = ctx.src:match("^([^%" .. quote .. "%\\]+)()", j);
		if part then
			table.insert(parts, part);
			j = p_i;
		end

		if ctx.src:match("^" .. quote, j) then
			j = j + 1;
			return j, table.concat(parts);
		elseif ctx.src:match("^\\", j) then
			local c;
			j, c = parse_escape_char(ctx, j + 1);
			table.insert(parts, c);
		else
			error(find_loc(ctx, i), "unterminated string literal");
		end
	end
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, ("int" | "fl")?, number?
local function parse_number(ctx, i)
	local j = i;

	local hex = ctx.src:match("^0x([a-fA-F0-9]+)", j);
	if hex then
		return j + #hex + 2, "int", tonumber(hex, 16);
	end

	local val, dot, e_sign, e;
	val = ctx.src:match("^%d+", j);
	if val then
		j = j + #val;

		dot = ctx.src:match("^%.(%d*)", j);
		if dot then
			j = j + #dot + 1;
			if #dot == 0 then dot = nil end
		end
	else
		dot = ctx.src:match("^%.(%d+)", j);
		if not dot then return i end

		j = j + #dot + 1;
	end

	e_sign, e = ctx.src:match("^[eE]([+-]?)(%d+)", j);
	if e then j = j + #e + 1 end

	if dot or e_sign == "-" then
		return j, "fl", tonumber((val or "") .. "." .. (dot or "") .. (e and "e" .. e or ""));
	end

	e = e and tonumber(e, 10) or 0;
	val = tonumber(val, 10);

	local a = 10;
	local exp = 1;

	while e > 0 do
		if e % 1 == 1 then
			exp = exp * a;
		end
		a = a * 10;
	end

	return j, "int", val * exp;
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, string?
local function parse_id(ctx, i)
	local res = ctx.src:match("^([a-zA-Z_][a-zA-Z0-9_]*)", i);
	if not res then return i end
	return i + #res, res;
end
--- @param ctx lex.ctx
--- @param i integer
--- @return integer, string?
local function parse_op(ctx, i)
	local res = "";
	local j = i;

	while j <= #ctx.src do
		local new_res = res .. ctx.src:sub(j, j);
		if not op_map[new_res] then break end

		j = j + 1;
		res = new_res;
	end

	if res == "" then return i end
	return j, res;
end
--- @param ctx lex.ctx
--- @param i integer?
local function parse_token(ctx, i)
	if not i or i > #ctx.src then return i end

	i = skip_white(ctx, i);
	if i > #ctx.src then return i end

	local loc = find_loc(ctx, i);

	local j, res = parse_string(ctx, i);
	if res then return j, { loc = loc, type = "str", val = res } end

	local j, kind, res = parse_number(ctx, i);
	if kind and res then return j, { loc = loc, type = kind, val = res } end

	local j, res = parse_id(ctx, i);
	if res then return j, { loc = loc, type = "id", val = res } end

	local j, res = parse_op(ctx, i);
	if res then return j, { loc = loc, type = "op", val = res } end

	error(loc, "unknown syntax");
end

--- @param src string
--- @param filename string
function lexer.parse(src, filename)
	--- @type lex.ctx
	local ctx = { lines = { 0 }, src = src, fname = filename };
	local i, tok;
	--- @type lex.tok[]
	local res = {};

	for i in src:gmatch "()\n" do
		table.insert(ctx.lines, i);
	end

	i = 1;
	while true do
		i, tok = parse_token(ctx, i);
		if not tok then break end

		table.insert(res, tok);

		if tok.type == "op" then
			-- The idea here is that sometimes, multichar operators may have to be split, while at other times, they will have to act together
			-- Such an example is this:
			-- list<dict<string, int>> a = 10; /* vs */ int my_int = 10 >> 5;
			-- Here, syntactically, we have the same token '>>'. To make the parser interpret `>>` as two distinct operators,
			-- we will insert synthetic operators after the real token:
			-- >> becomes '>>', '>'
			-- &&= becomes '&&=', '&=' and '='
			-- A hypothetical operator of !@#$ bectomees '!@#$', '@#$', '#$', '$'
			-- Later, in the parsing process, when we read an operator, we skip as many tokens as characters we read from the operator
			for i = 2, #tok.val do
				table.insert(res, { type = "op", loc = tok.loc, val = tok.val:sub(i) });
			end
		end
	end

	table.insert(res, { type = "eof", loc = node.loc(filename, ctx.lines[#ctx.lines] + 1, 1) });

	for i = 1, #res do
		res[i].loc = nil;
	end
	return res;
end

return lexer;
