#pragma once

#include "treeifier/constructs/glob.hh"

#ifdef PROFILE_debug
#include <iostream>
#endif

namespace ppc::tree::constr {
    using namespace ppc::lang;
    using namespace ppc::messages;
    using namespace ppc::tree::constr;

    struct type_t {
        loc_nmsp_t name;

        #ifdef PROFILE_debug
        void print() const {
            std::cout << "";
        }
        #endif
    };
}