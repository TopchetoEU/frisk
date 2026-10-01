local err_marker = {};

--- @param loc node.loc | { loc: node.loc }
--- @param msg string
--- @return ...
local function throw(loc, msg)
	if type(loc) == "table" and loc.loc then
		loc = loc.loc;
	end

	error({
		loc = loc,
		msg = msg,
		[err_marker] = true,
	}, 0);
end

local function catch_fin(ok, ...)
	if ok then return true, ... end

	local err = ...;

	if type(err) == "table" and err[err_marker] then
		return false, err.msg, err.loc;
	else
		error(err, 0);
	end
end

local function catch_handle(err)
	if type(err) == "table" and err[err_marker] then
		return err;
	else
		return debug.traceback(err, 2);
	end
end

local function catch(func, ...)
	return catch_fin(xpcall(func, catch_handle, ...));
end

return {
	throw = throw,
	catch = catch,
}
