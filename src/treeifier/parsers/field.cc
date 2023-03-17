#include "treeifier/constr.hh"
#include "treeifier/constructs/field.hh"
#include "treeifier/parsers/helper.hh"
#include "treeifier/parsers/field.hh"

using namespace ppc::tree::parse;

bool field_parser_t::operator()(parse_ctx_t &ctx, size_t &res_i, constr::field_t &out) const {
    helper_t h(ctx, res_i);
    out = {};

    if (!h.parse(parse_identifier, out.name)) return false;
    if (check_operator(ctx, h.i, operator_t::COLON)) {
        h.force_parse(parse_type, "A type was expected after colon.", out.name);
        return h.submit(false);
    }
    if (check_operator(ctx, h.i, operator_t::EQUALS)) {
        return h.err("Field default values are not yet supported.");
    }

    return false;
}
