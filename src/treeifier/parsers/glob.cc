#include "treeifier/constr.hh"
#include "treeifier/parsers/helper.hh"
#include "treeifier/parsers/field.hh"
#include "treeifier/parsers/glob.hh"
#include "treeifier/constructs/glob.hh"

using namespace ppc::tree::parse;

bool glob_parser_t::operator()(parse_ctx_t &ctx, constr::global_t &out) const {
    size_t res_i = 0;
    helper_t h(ctx, res_i);
    out = {};

    if (h.ended()) return h.submit(false);

    if (h.curr().is_identifier("namespace")) {
        h.advance("Expected a namespace");
        h.force_parse(parse_nmsp, "Expected a namespace.", out.nmsp);

        if (!h.curr().is_operator(operator_t::SEMICOLON)) {
            ctx.messages.push(message_t::error("Expected a semicolon.", h.loc(1)));
        }

        if (!h.try_advance()) return h.submit(false);
    }

    while (h.curr().is_identifier("import")) {
        loc_nmsp_t res;

        h.advance("Expected a namespace");
        h.force_parse(parse_nmsp, "Expected a namespace.", res);

        if (!h.curr().is_operator(operator_t::SEMICOLON)) {
            ctx.messages.push(message_t::error("Expected a semicolon.", h.loc(1)));
        }

        out.imports.push_back(res);
        if (!h.try_advance()) return h.submit(false);
    }

    while (true) {
        if (h.ended()) break;
        std::unique_ptr<definition_t> def;

        if (h.parse(defs, def)) {
            out.defs.push_back(std::move(def));
        }
        else {
            h.msgs().err("Unexpected token.", h.loc());
        }

        if (!h.try_advance()) break;
    }

    return h.submit(false);
}


glob_parser_t::glob_parser_t() {
    defs.add("$_field", std::make_unique<definition_parser_t>(field_parser_t()));
}