local err = require "compiler.util.err";
local nodes = require "compiler.util.node";
local resolve_type = require "compiler.resolve.type";

--- @class rsl.cfg.exp.call
--- @field kind "call"
--- @field what rsl.cfg.exp
--- @field args rsl.cfg.exp[]

--- @class rsl.cfg.exp.field
--- @field kind "field"
--- @field i integer
--- @field what rsl.cfg.exp

--- @class rsl.cfg.exp.deref
--- @field kind "deref"
--- @field what rsl.cfg.exp

--- @class rsl.cfg.exp.arg
--- @field kind "arg"
--- @field i integer
--- @field param rsl.param

--- @class rsl.cfg.exp.local
--- @field kind "local"
--- @field var rsl.cfg.local

--- @class rsl.cfg.exp.global
--- @field kind "global"
--- @field decl rsl.sym

--- @class rsl.cfg.exp.const
--- @field kind "const"
--- @field data string

--- @class rsl.cfg.exp.assign
--- @field kind "assign"
--- @field where rsl.cfg.where
--- @field what rsl.cfg.exp

--- @alias rsl.cfg.where rsl.cfg.exp.field | rsl.cfg.exp.deref | rsl.cfg.exp.arg | rsl.cfg.exp.local | rsl.cfg.exp.global
--- @alias rsl.cfg.exp rsl.cfg.where | rsl.cfg.exp.call | rsl.cfg.exp.assign | rsl.cfg.exp.const

--- @class rsl.cfg.local
--- @field type rsl.type
--- @field i integer
--- @field name string
--- @field scope rsl.cfg.scope

--- @class rsl.cfg.scope
--- @field parent? rsl.cfg.scope
--- @field list rsl.cfg.local[]
--- @field map table<string, rsl.cfg.local>

--- @class rsl.cfg.ctx
--- @field file walk.file
--- @field sig? rsl.type_func
--- @field param_map? table<string, integer>
--- @field scope? rsl.cfg.scope

--- @class rsl.sym
--- @field type rsl.type
--- @field val rsl.cfg.exp

--- @alias rsl.raw
--- | node.exp
--- | { kind: "rsl", val: rsl.cfg.exp, type: rsl.type }
--- | { kind: "const", val: rsl.cfg.exp.const }

local resolve_syms;

--- @type table<string, fun(ctx: rsl.cfg.ctx, node: node.exp, target?: rsl.type): rsl.cfg.exp, rsl.type>
local exp_resolvers = {};

--- @param ctx rsl.cfg.ctx
--- @param dst "reg" | "ref" | "own"
--- @param src rsl.cfg.exp
local function try_copy(ctx, dst, src)
	-- TODO: implemnet copy/move rules
	return true;
end
--- @param ctx rsl.cfg.ctx
--- @param dst "reg" | "ref" | "own"
--- @param src rsl.cfg.exp
local function try_pass(ctx, dst, src)
	if dst == "reg" then
		return true;
	end

	if src.kind == "call" then
		return false, "call result cannot be pased to a 'ref' or 'own' parameter";
	elseif src.kind == "field" then
		return try_pass(ctx, dst, src.what);
	elseif src.kind == "deref" then
		if dst == "ref" then
			return true;
		else
			return try_copy(ctx, dst, src);
		end
	elseif src.kind == "local" then
		if dst == "ref" then
			return true;
		else
			return try_copy(ctx, dst, src);
		end
	elseif src.kind == "global" then
		if dst == "ref" then
			return true;
		else
			return try_copy(ctx, dst, src);
		end
	elseif src.kind == "arg" then
		if src.param.kind == "reg" then
			return false, "regular argument cannot be passed to a 'ref' or 'own' parameter";
		elseif src.param.kind == "ref" then
			if dst == "own" then
				return false, "'ref' argument cannot be passed to an 'own' parameter";
			end
		end

		return true;
	else
		error "wtf";
	end
end

--- @param ctx rsl.cfg.ctx
--- @param val rsl.cfg.exp
--- @param type rsl.type
--- @param target? rsl.type
local function resolve_cast(ctx, val, type, target)
	if not target then return val, type end

	if type ~= target then
		if type.kind == "struct" then
			for i = 1, #type.fields do
				local field = type.fields[i];
				if not field.name then
					local res, res_t = resolve_cast(ctx, { kind = "field", what = val, i = i } --[[@as rsl.cfg.exp]], field.type, target);
					if res then return res, res_t end
				end
			end
		end
	end

	return val, type;
end

--- @param ctx rsl.cfg.ctx
--- @param exp rsl.raw
--- @param target? rsl.type
local function resolve_exp(ctx, exp, target)
	if exp.kind == "rsl" then
		return exp.val, exp.type;
	end

	if not exp_resolvers[exp.kind] then
		err.throw(exp.loc, "expression type '" .. exp.kind .. "' not supported");
	end
	return exp_resolvers[exp.kind](ctx, exp, target);
end

--- @param ctx rsl.cfg.ctx
--- @param callee rsl.cfg.exp
--- @param callee_t rsl.type
--- @param arg_nodes rsl.raw[]
--- @param target? rsl.type
local function resolve_val_call(ctx, callee, callee_t, arg_nodes, target)
	if callee_t.kind ~= "func" then return nil end
	if target and not resolve_type.eq(callee_t.ret_type, target) then return nil end

	-- TODO: implement variadics and optionals
	if #arg_nodes ~= #callee_t.params then return nil end

	local args = {};
	local problems = {};

	for i, arg_node in ipairs(arg_nodes) do
		local arg, arg_t;

		arg, arg_t = resolve_exp(ctx, arg_node, callee_t.params[i].type);

		if not resolve_type.eq(callee_t.params[i].type, arg_t) then return nil end

		if callee_t.params[i].kind ~= "reg" then
			local ok, msg = try_pass(ctx, callee_t.params[i].kind, arg);
			if not ok then
				table.insert(problems, { loc = arg_node.loc, msg = msg });
			end
		end

		table.insert(args, arg);
	end

	for _, problem in ipairs(problems) do
		err.throw(problem.loc, problem.msg);
	end

	return {
		kind = "call",
		what = callee,
		args = arg_nodes,
	} --[[@as rsl.cfg.exp.call]], callee_t.ret_type;
end

--- @param ctx rsl.cfg.ctx
--- @param loc node.loc
--- @param syms rsl.sym[]
--- @param arg_nodes rsl.raw[]
--- @param target? rsl.type
local function resolve_func_call(ctx, loc, syms, arg_nodes, target)
	--- @type rsl.cfg.exp.call[]
	local candidates = {};
	local res_t;

	for _, sym in ipairs(syms) do
		local res, curr_res_t = resolve_val_call(ctx, { kind = "global", decl = sym }, sym.type, arg_nodes, target);
		if res then
			res_t = curr_res_t;
			table.insert(candidates, res);
		end
	end

	if #candidates == 0 then
		err.throw(loc, "no overload found for call");
	end
	if #candidates > 1 then
		err.throw(loc, "ambiguous call - more than one overload match");
	end

	return candidates[1], res_t --[[@as rsl.type]];
end
--- @param ctx rsl.cfg.ctx
--- @param loc node.loc
--- @param obj_node rsl.raw
--- @param arg_nodes rsl.raw[]
--- @param target? rsl.type
local function resolve_method(ctx, loc, name, obj_node, arg_nodes, target)
	local obj, obj_t = resolve_exp(ctx, obj_node);
	if not obj_t.name then
		err.throw(loc, "methods exist only for named types");
	end

	local sym = ctx.file.syms:get_symbol(obj_t.name .. "::" .. name);
	if not sym then
		err.throw(loc, "method '" .. name .. "' not found for type '" .. obj_t.name .. "'");
	end

	-- TODO: pass already resolved object properly
	return resolve_func_call(ctx, loc, sym, { { kind = "rsl", val = obj, val_t = obj_t }, table.unpack(arg_nodes) }, target);
end
--- @param ctx rsl.cfg.ctx
--- @param loc node.loc
--- @param arg_nodes rsl.raw[]
--- @param target? rsl.type
local function resolve_operator(ctx, loc, name, arg_nodes, target)
	local sym = ctx.file.syms:get_symbol(name);
	if not sym then
		err.throw(loc, "operator '" .. name .. "' not found");
	end

	return resolve_func_call(ctx, loc, sym, arg_nodes, target);
end

--- @param ctx rsl.cfg.ctx
--- @param loc node.loc
--- @param syms rsl.sym[]
--- @param target? rsl.type
local function resolve_var(ctx, loc, syms, target)
	local candidates = {};

	for _, sym in ipairs(syms) do
		if not target or resolve_type.eq(target, sym.type) then
			table.insert(candidates, { kind = "global", decl = sym });
		end
	end

	if #candidates == 0 then
		err.throw(loc, "variable type doesn't match");
	end
	if #candidates > 1 then
		err.throw(loc, "ambiguous variable reference - too many overloads match");
	end

	return candidates[1];
end

local arith_ops = {
	[nodes.ops.NOT] = "op::not",
	[nodes.ops.EQ] = "op::eq",

	[nodes.ops.NEG] = "op::neg",
	[nodes.ops.POS] = "op::pos",

	[nodes.ops.ADD] = "op::add",
	[nodes.ops.SUB] = "op::sub",
	[nodes.ops.MUL] = "op::mul",
	[nodes.ops.DIV] = "op::div",
	[nodes.ops.MOD] = "op::mod",

	[nodes.ops.B_AND] = "op::binand",
	[nodes.ops.B_OR] = "op::binor",
	[nodes.ops.B_XOR] = "op::binxor",
	[nodes.ops.B_SHL] = "op::binshl",
	[nodes.ops.B_SHR] = "op::binshr",
};
local cmp_ops = {
	[nodes.ops.GR] = "op::gr",
	[nodes.ops.GREQ] = "op::greq",
	[nodes.ops.LE] = "op::le",
	[nodes.ops.LEQ] = "op::leq",
};


--- @param node rsl.cfg.exp.const
function exp_resolvers.const(ctx, node, target)
	return resolve_operator(ctx, node.loc, "op::lit::str", {}, target);
end

--- @param node node.lit_str
function exp_resolvers.str(ctx, node, target)
	return resolve_operator(ctx, node.loc, "op::lit::str", {}, target);
end

--- @param node node.lit_int
function exp_resolvers.lit_int(ctx, node, target)
	local bytes = {};
	local val = node.val;

	while val > 0 do
		table.insert(bytes, val & 0xFF);
		val = val >> 8;
	end

	return resolve_operator(ctx, node.loc, "op::lit", { { kind = "rsl", val = { kind  } } }, target);
end

--- @param node node.op
function exp_resolvers.op(ctx, node, target)
	if node.op == nodes.ops.DEREF then
		local exp, exp_t = resolve_exp(ctx, node[1]);
		if exp_t.kind == "ptr" or exp_t.kind == "uptr" then
			return { kind = "deref", what = exp } --[[@as rsl.cfg.exp.deref]], exp_t.type;
		end

		err.throw(node, "only pointers may be dereferenced");
	end

	if cmp_ops[node.op] then
		local cmp_call, cmp_call_t = resolve_operator(ctx, node.loc, "op::cmp", node, nil);
		return resolve_method(ctx, node.loc, cmp_ops[node.op], { kind = "rsl", val = cmp_call, val_t = cmp_call_t }, {}, target);
	end

	if arith_ops[node.op] then
		return resolve_operator(ctx, node.loc, "op::cmp", node, target);
	end

	err.throw(node, "unsupported operator");
end

--- @param node node.member
function exp_resolvers.member(ctx, node)
	local obj, obj_t = resolve_exp(ctx, node.obj);

	if obj_t.kind == "uptr" then
		obj = { kind = "deref", what = obj };
		obj_t = obj_t.type;
	end

	if obj_t.kind ~= "struct" and obj_t.kind ~= "union" then
		err.throw(node, "cannot get field of ")
	end

	local path = obj_t.cache[node.key];
	if not path then err.throw(node, "field '" .. node.key .. "' not found") end

	local res = obj;
	local res_t = obj_t;

	for _, i in ipairs(path) do
		res = { kind = "field", i = i, what = res };
		res_t = res_t.fields[i] --[[@as rsl.type_struct]];
	end

	return res, res_t;
end

--- @param node node.assign
function exp_resolvers.assign(ctx, node, target_t)
	local where, where_t = resolve_exp(ctx, node.target, target_t);
	if
		where.kind ~= "field" and
		where.kind ~= "deref" and
		where.kind ~= "var" and
		where.kind ~= "local" and
		where.kind ~= "arg"
	then
		err.throw(node, "assign target must be a field, dereference, var or a local");
	end

	if where.kind == "arg" and where.param.kind == "reg" then
		err.throw(node, "cannot assign to regular parameter (try 'ref' or 'own' parameters)");
	end

	local val, val_t = resolve_exp(ctx, node.val, where_t);

	if not resolve_type.eq(val_t, where_t) then
		err.throw(node, "assign value's type doesn't match assign target");
	end

	return {
		kind = "assign",
		where = where,
		what = val,
	}, where_t;
end

--- @param node node.var
function exp_resolvers.var(ctx, node, target_t)
	local curr = ctx.scope;

	while curr do
		local var = curr.map[node.name];
		if var then
			return { kind = "local", var = var }, var.type;
		end

		curr = curr.parent;
	end

	if ctx.param_map[node.name] then
		local param = ctx.sig.params[ctx.param_map[node.name]];
		return { kind = "arg", i = ctx.param_map[node.name], param = param }, param.type;
	end

	local syms = ctx.file.syms:get_symbol(node.name);
	if syms then
		resolve_syms(ctx.file, syms);

		if target_t then
			for _, sym in ipairs(syms) do
				assert(sym.resolved);

				if resolve_type.eq(sym.resolved.type, target_t) then
					return { kind = "global", var = sym.resolved }, sym.resolved.type;
				end
			end

			err.throw(node.loc, "no overload matching target type");
		elseif #syms > 1 then
			err.throw(node.loc, "multiple overloads exist for symbol (use a cast to explicitly select overload)");
		else
			return { kind = "global", var = syms[1].resolved }, syms[1].resolved.type;
		end
	end

	err.throw(node.loc, "no local, argument or global found");
end

--- @param node node.func
function exp_resolvers.func(ctx, node)
	local sig = resolve_type.resolve(ctx.file, node.sig) --[[@as rsl.type_func]];
	err.throw(node.loc, "TODO: implement statement walking");
end


--- @param file walk.file
--- @param node node.exp
--- @param target? rsl.type
--- @return rsl.cfg.exp, rsl.type
local function resolve_exp(file, node, target)
	return resolve_exp({ file = file }, node, target);
end

--- @param file walk.file
--- @param syms walk.sym[]
function resolve_syms(file, syms)
	for i, sym in ipairs(syms) do
		if not sym.resolved then
			if not sym.val then
				err.throw(sym.loc, "symbol must have an initializer");
			end

			local sym_type = resolve_type.resolve(file, sym.type);
			local sym_val, sym_real_type = resolve_exp(file, sym.val, sym_type);

			if not resolve_type.eq(sym_type, sym_real_type) then
				err.throw(sym.loc, "initializer's type doesn't match symbol's type");
			end

			for j = 1, i - 1 do
				if not resolve_type.eq(syms[j].resolved.type, sym_type) then
					err.throw(sym.loc, "overload with same type already declared");
				end
			end

			sym.resolved = {
				type = sym_type,
				val = sym_val,
			};
		end
	end
end

return {
	resolve_syms = resolve_syms,
	resolve_exp = resolve_exp,
}
