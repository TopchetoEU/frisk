local err = require "compiler.util.err"

local next_id = 1;

--- @class rsl.param
--- @field kind "reg" | "ref" | "own"
--- @field type rsl.type
--- @field name? string

--- @class rsl.type_func
--- @field kind "func"
--- @field params rsl.param[]
--- @field ret_type rsl.type

--- @class rsl.type_field
--- @field name? string
--- @field type rsl.type

--- @class rsl.type_struct
--- @field kind "struct" | "union"
--- @field id? integer
--- @field name? string
--- @field fields rsl.type_field[]
--- @field cache table<string, rsl.field_path>
--- @field done? boolean Serves as a circular dependency detection

--- @class rsl.type_int
--- @field kind "int" | "float"
--- @field size integer | "size"
--- @field signed boolean

--- @class rsl.type_marker
--- @field kind "void" | "bool"

--- @class rsl.type_ptr
--- @field kind "uptr" | "ptr"
--- @field type rsl.type

--- @class rsl.type_literal
--- @field kind "lit"
--- @field node node.lit_int

--- Very simple placeholder for generic builtins. In normal code, this is an invalid type.
--- However, this is the only type that supports generic args. It constructs either a builtin or a composite type
--- @class rsl.type_generic
--- @field kind "generic"
--- @field what "opt"

--- @alias rsl.type rsl.type_struct | rsl.type_int | rsl.type_ptr | rsl.type_generic | rsl.type_marker | rsl.type_func

local resolve;

--- @param type rsl.type
--- @param list? table<string, true>
local function type_list_fields(type, list)
	if type.kind == "struct" or type.kind == "union" then
		list = list or {};

		for _, field in ipairs(type.fields) do
			if field.name then
				list[field.name] = true;
			else
				type_list_fields(type, list);
			end
		end
	else
		return nil;
	end

	return list;
end
--- @param a rsl.type
--- @param b rsl.type
local function type_eq(a, b)
	if a.kind ~= b.kind then return false end

	if a.kind == "struct" and b.kind == "struct" then
		if a.id or b.id then
			return a.id == b.id;
		end

		if #a.fields ~= #b.fields then return false end

		for i = 1, #a.fields do
			local a_field = a.fields[i];
			local b_field = b.fields[i];

			if a_field.name ~= b_field.name then return false end
			if not type_eq(a_field.type, b_field.type) then return false end
		end

		return true;
	elseif
		a.kind == "ptr" and b.kind == "ptr" or
		a.kind == "gc_ptr" and b.kind == "gc_ptr" or
		a.kind == "ref" and b.kind == "ref"
	then
		return type_eq(a.type, b.type);
	elseif a.kind == "int" and b.kind == "int" then
		return a.size == b.size and a.signed == b.signed;
	elseif a.kind == "sig" and b.kind == "sig" then
		if #a.params ~= #b.params then return false end
		if not type_eq(a.ret_type, b.ret_type) then return false end

		for i = 1, #a.params do
			if not type_eq(a.params[i].type, b.params[i].type) then return false end
			-- Should void (ref int a) and void (int a) be equal or not?
			-- TODO: dwell on this
		end

		return true;
	end

	return false;
end
--- @param type rsl.type
--- @param name string
local function type_get_field(type, name)
	if type.kind == "struct" or type.kind == "union" then
		if type.cache[name] then return type.cache[name] end

		--- @type rsl.field_path?
		local new_path;
		for i, field in ipairs(type.fields) do
			if field.name then
				if field.name == name then
					new_path = { i } --[[@as rsl.field_path]];
					break;
				end
			elseif type.kind == "struct" then
				local res = type_get_field(type, name);
				if res then
					new_path = table.move(res, 1, #res, 2, { i });
					break;
				end
			end
		end

		if new_path then
			type.cache[name] = new_path;
			return new_path;
		end
	end

	return nil;
end
-- Very bad solution to not implementing generics right away
local function resolve_type_generic(file, type, node)
	if type.kind ~= "generic" then return nil end

	if type.what == "opt" then
		if #node.args ~= 1 then
			return err.throw(node.loc, "opt<T> accepts one generic parameter");
		end

		return {
			kind = "union",
			cache = {},
			done = true,
			fields = {
				{ type = resolve(file, node.args[1]) },
				{ type = { kind = "void" } },
			}
		} --[[@as rsl.type_struct]];
	end
end
--- @param file walk.file
--- @param node node.type | node.decl_struct | node.decl_union
--- @param walk? walk.type
--- @param path? table<walk.type, true>
--- @return rsl.type
function resolve(file, node, walk, path)
	if node.kind == "type_id" then
		local aliased = file.syms:get_type(node.name);
		if not aliased then return err.throw(node.loc, "type '" .. node.name .. "' not found") end

		local res;

		if aliased.resolved then
			res = assert(aliased.resolved);
		else
			if not path then
				path = {};
			end

			if path[aliased] then
				return err.throw(aliased, "recursive typedef");
			end

			path[aliased] = true;

			res = resolve(aliased.file, aliased.type, aliased, path);
		end

		--- @cast res rsl.type

		if #node.args > 0 then
			local new_res = resolve_type_generic(file, res, node);
			if not new_res then return err.throw(node.loc, "full generics not supported") end
			res = new_res;
		end

		if walk then walk.resolved = res end
		return res;
	elseif node.kind == "type_struct" or node.kind == "decl_struct" then
		--- @type rsl.type_struct
		local res = {
			kind = "struct",
			fields = {},
			cache = {},
		};

		if node.kind == "decl_struct" then
			res.id = next_id;
			res.name = node.name;
			next_id = next_id + 1;
			if walk then walk.resolved = res end
		end

		for _, field in ipairs(node.fields) do
			local field_t = resolve(file, field.type);

			if (field_t.kind == "struct" or field_t.kind == "union") and not field_t.done then
				return err.throw(field, "field has recursive type");
			end

			if field.name == nil then
				local fields = type_list_fields(field_t);
				if not fields then
					return err.throw(field, "unnamed fields in structs may only be of a struct or union type");
				else
					for k in pairs(fields) do
						if type_get_field(res, k) then
							return err.throw(field, "field '" .. k .. "', that expands from this unnamed field, already exists in struct");
						end
					end
				end
			elseif type_get_field(res, field.name) then
				return err.throw(field, "field '" .. field.name .. "' already exists in struct");
			end

			table.insert(res.fields, { name = field.name, type = field_t });
		end

		res.done = true;
		return res;
	elseif node.kind == "type_union" or node.kind == "decl_union" then
		--- @type rsl.type_struct
		local res = {
			kind = "union",
			fields = {},
			cache = {},
		};

		if node.kind == "decl_union" then
			res.id = next_id;
			res.name = node.name;
			next_id = next_id + 1;
			if walk then walk.resolved = res end
		end

		for _, field in ipairs(node.fields) do
			local field_t = resolve(file, field.type);

			if (field_t.kind == "struct" or field_t.kind == "union") and not field_t.done then
				return err.throw(field, "field has recursive type");
			end

			if field.name == nil then
				for _, field in ipairs(res.fields) do
					if type_eq(field_t, field.type) then
						return err.throw(field, "unnamed field of the same type already exists in union");
					end
				end
			elseif type_get_field(res, field.name) then
				return err.throw(field, "field '" .. field.name .. "' already exists in union");
			end

			table.insert(res.fields, { name = field.name, type = field_t });
		end

		res.done = true;
		return res;
	elseif node.kind == "type_func" then
		--- @type rsl.type_func
		local res = {
			kind = "func",
			params = {},
			ret_type = resolve(file, node.ret),
		};

		for _, raw_param in ipairs(node.params) do
			table.insert(res.params, {
				kind = raw_param.kind or "reg",
				name = raw_param.name,
				type = resolve(file, raw_param.type),
			} --[[@as rsl.param]])
		end

		return res;
	elseif node.kind == "type_uptr" then
		local res = { kind = "uptr", type = resolve(file, node.val) };
		if walk then walk.resolved = res end
		return res;
	elseif node.kind == "type_ptr" then
		local res = { kind = "ptr", type = resolve(file, node.val) };
		if walk then walk.resolved = res end
		return res;
	end

	error "wtf";
end

return {
	resolve = resolve,
	eq = type_eq,
	get_field = type_get_field,
};
