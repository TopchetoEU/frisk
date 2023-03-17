#pragma once

#include <vector>
#include <memory>
#include "lang/common.hh"
#include "utils/message.hh"
#include "treeifier/constructs/glob.hh"
#include "treeifier/constructs/type.hh"

#ifdef PROFILE_debug
#include <iostream>
#endif

namespace ppc::tree::constr {
    using namespace ppc::lang;
    using namespace ppc::messages;
    using namespace ppc::tree::constr;

    struct field_t : public definition_t {
        type_t type;
        located_t<std::string> name;

        #ifdef PROFILE_debug
        void print() const override {
            std::cout << name << ": ";
            for (size_t i = 0; i < type.name.size(); i++) {
                if (i) std::cout << "::";
                std::cout << type.name[i];
            }
        }
        #endif
    };
}