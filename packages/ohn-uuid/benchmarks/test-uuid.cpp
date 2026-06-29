#include <iostream>
#include <uuid/uuid.h>

int main() {
    uuid_t out;
    uuid_generate_random(out);
    char outStr[37];
    uuid_unparse_lower(out, outStr);
    std::cout << outStr << std::endl;
    return 0;
}
