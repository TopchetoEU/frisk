local syntax = require "compiler.syntax";
local symbols = require "compiler.util.symbols";
local err = require "compiler.util.err";

--- @class walk.sym
--- @field file walk.file
--- @field loc node.loc
--- @field type node.type
--- @field val? node.exp
--- @field resolved? rsl.sym

--- @class walk.type
--- @field file walk.file
--- @field name string
--- @field loc node.loc
--- @field type node.type | node.decl_union | node.decl_struct
--- @field resolved? rsl.type

--- @class walk.file
---
--- @field filename string
---
--- @field syms file.symbols
--- @field exports file.symbols
---
--- Stuff, deferred for the wildcard import/export stage:
--- @field export_w node.export_alias[]
--- @field import_w { file: walk.file, node: node.import }[]


local function resolve_path(name, prev_name)
	if prev_name and name:match "^%." then
		local root = prev_name:match "^(.-/)([^/]*)$" or "";
		local new_name = root .. name;
		local f = io.open(new_name);
		if f then return f, new_name end
	end
	local f = io.open(name);
	if f then return f, name end

	return nil;
end

--- @param file walk.file
--- @param sym walk.sym
--- @param name string
--- @param export? string
local function add_sym(file, sym, name, export)
	file.syms:add_sym(name, sym);
	if export then
		file.exports:add_sym(export, sym);
	end
end
--- @param file walk.file
--- @param type walk.type
--- @param name string
--- @param export? string
local function add_type(file, type, name, export)
	if not file.syms:add_type(name, type) then return "decl" end
	if export and not file.exports:add_type(export, type) then return "export" end
end

--- @param export? true | string
local function add_decl(file, _node, export)
	if _node.kind == "decl_struct" or _node.kind == "decl_union" or _node.kind == "decl_type" then
		if export == true then export = _node.name end

		local err_kind;

		if _node.kind == "decl_struct" then
			err_kind = add_type(file, { file = file, name = _node.name, loc = _node.loc, type = _node }, _node.name, export);
		elseif _node.kind == "decl_union" then
			err_kind = add_type(file, { file = file, name = _node.name, loc = _node.loc, type = _node }, _node.name, export);
		else
			err_kind = add_type(file, { file = file, name = _node.name, loc = _node.loc, type = _node.type }, _node.name, export);
		end

		if err_kind == "decl" then
			err.throw(_node, "type '" .. _node.name .. "' already declared");
		elseif err_kind == "export" then
			err.throw(_node, "type '" .. _node.name .. "' already exported");
		end
	elseif _node.kind == "decl_var" then
		for _, part in ipairs(_node.parts) do
			if part.params then
				err.throw(_node.loc, "generics are not supported yet");
			end
		end

		if export then
			if #_node.parts > 1 then
				err.throw(_node.loc, "an aliased exported variable may contain only one variable declaration");
			end

			--- @type walk.sym
			local var = {
				file = file,
				loc = _node.loc,
				type = _node.type,
				val = _node.parts[1].val,
			};

			if export == true then export = _node.parts[1].name end
			add_sym(file, var, _node.parts[1].name, export);
		else
			for _, part in ipairs(_node.parts) do
				local name = part.name;

				local var = { loc = _node.loc, type = _node.type, val = part.val };

				add_sym(file, var, name);
			end
		end
	elseif _node.kind == "cond" then
		err.throw(_node, "top-level conditions not supported yet");
	end
end

--- First step, walks all declarations that are concretely known
--- @param files table<string, walk.file>
--- @param parent? walk.file
--- @param filename string
--- @param f? file*
--- @return walk.file?
local function walk_decls(files, parent, filename, f)
	if filename == "builtin/types" then return (require "compiler.mods.types") end

	if not f then
		local new_filename
		f, new_filename = resolve_path(filename, parent and parent.filename);
		if not f or not new_filename then return nil end

		filename = new_filename;
	end

	if files[filename] then
		f:close();
		return files[filename];
	end

	local ast = syntax(assert(f:read("a")), filename);
	f:close();

	--- @type walk.file
	local file = {
		filename = filename,
		ready = false,

		syms = symbols(),
		exports = symbols(),

		export_w = {},
		import_w = {},
	};

	for _, node in ipairs(ast) do
		-- TODO: check recursive imports
		if node.kind == "import" then
			local i_file = walk_decls(files, file, node.file);
			if not i_file then err.throw(node.loc, "import '" .. node.file .. "' not found") end
			table.insert(file.import_w, { file = i_file, node = node });
		end

		if node.kind == "export_decl" then
			add_decl(file, node.decl, node.alias or true);
		elseif node.kind == "export_alias" then
			table.insert(file.export_w, node);
		else
			add_decl(file, node, nil);
		end
	end

	files[filename] = file;
	return file;
end

--- @param file walk.file
--- @param passed table<walk.file, true>
local function walk_aliases(file, passed, res)
	if passed[file] then return end
	passed[file] = true;
	table.insert(res, file);

	for _, import in ipairs(file.import_w) do
		walk_aliases(import.file, passed, res);
	end

	for _, import in ipairs(file.import_w) do
		for _, part in ipairs(import.node.parts) do
			if part.wildcard then
				local ok, err_kind, err_name = file.syms:copy_wildcard(import.file.exports, part.selector, part.alias);
				if err_kind then
					if err_kind == "sym" then
						err.throw(part, "imported symbol '" .. err_name .. "' collides with other local symbols in this file");
					elseif err_kind == "type" then
						err.throw(part, "imported type '" .. err_name .. "' collides with other local types in this file");
					end
				end
			else
				local ok, err_kind = file.syms:copy(import.file.exports, part.selector, part.alias);
				if err_kind then
					if err_kind == "sym" then
						err.throw(part, "imported symbol '" .. part.selector .. "' collides with other local symbols in this file");
					elseif err_kind == "type" then
						err.throw(part, "imported type '" .. part.selector .. "' collides with other local types in this file");
					end
				elseif not ok then
					err.throw(part, "no symbol or type '" .. part.selector .. "'");
				end
			end
		end
	end

	for _, export in ipairs(file.export_w) do
		if export.wildcard then
			local ok, err_kind, err_name = file.exports:copy_wildcard(file.syms, export.selector, export.alias);
			if err_kind then
				if err_kind == "sym" then
					err.throw(export, "exported symbol '" .. err_name .. "' collides with other exported symbols in this file");
				elseif err_kind == "type" then
					err.throw(export, "exported type '" .. err_name .. "' collides with other exported types in this file");
				end
			end
		else
			local ok, err_kind = file.exports:copy(file.syms, export.selector, export.alias);
			if err_kind then
				if err_kind == "sym" then
					err.throw(export, "exported symbol '" .. export.selector .. "' collides with other exported symbols in this file");
				elseif err_kind == "type" then
					err.throw(export, "exported type '" .. export.selector .. "' collides with other exported types in this file");
				end
			elseif not ok then
				err.throw(export, "no symbol or type '" .. export.selector .. "'");
			end
		end
	end
end

--- @param filename string
--- @return walk.file[]? exports
return function (filename)
	local file = assert(walk_decls({}, nil, filename, assert(io.open(filename))));

	--- @type table<walk.file, true>
	local set = {};
	--- @type walk.file[]
	local res = {};

	walk_aliases(file, set, res);

	return res;
end
