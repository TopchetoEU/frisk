--- @class file.symbols
--- @field syms table<string, walk.sym[]>
--- @field types table<string, walk.type>
local symbols_index = {};
local symbols_meta = { __index = symbols_index };

--- @param name string
--- @param sym walk.sym
function symbols_index:add_sym(name, sym)
	if not self.syms[name] then
		self.syms[name] = { sym };
	else
		table.insert(self.syms[name], sym);
	end
end
--- @param type walk.type
--- @param name string
function symbols_index:add_type(name, type)
	if self.types[name] then return false end

	self.types[name] = type;
	return true;
end

--- @param name string
--- @return walk.sym[]?
function symbols_index:get_symbol(name)
	return self.syms[name];
end
--- @param name string
--- @return walk.type?
function symbols_index:get_type(name)
	return self.types[name];
end

--- @param from file.symbols
--- @param name string
--- @param alias? string
--- @return boolean?
--- @return "sym" | "type"?
function symbols_index:copy(from, name, alias)
	local any = false;

	local syms = from:get_symbol(name);
	if syms then
		for _, sym in ipairs(syms) do
			if not self:add_sym(alias or name, sym) then
				return nil, "sym";
			end

			any = true;
		end
	end

	local type = from:get_type(name);
	if type then
		if not self:add_type(alias or name, type) then
			return nil, "type";
		end

		any = true;
	end

	return any;
end
--- @param from file.symbols
--- @param name string
--- @param alias? string
--- @return boolean?
--- @return "type"?
--- @return string?
function symbols_index:copy_wildcard(from, name, alias)
	for sym_name, syms in pairs(from.syms) do
		if name == "" or sym_name == name or sym_name:find(name .. "::", 1, true) then
			local real_name = sym_name;
			if alias then real_name = alias .. (name and real_name:sub(#name + 1) or ("::" .. real_name)) end

			for _, sym in ipairs(syms) do
				self:add_sym(real_name, sym);
			end
		end
	end

	for type_name, type in pairs(from.types) do
		if name == "" or type_name == name or type_name:find(name .. "::", 1, true) then
			local real_name = type_name;
			if alias then real_name = alias .. (name and real_name:sub(#name + 1) or ("::" .. real_name)) end

			if not self:add_type(real_name, type) then
				return nil, "type", type_name;
			end
		end
	end

	return true;
end

--- @return file.symbols
return function ()
	return setmetatable({
		syms = {},
		types = {},
	}, symbols_meta);
end
