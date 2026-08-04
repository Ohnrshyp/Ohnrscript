import sys

bindings_path = "/Users/jordankugler/Cursor/ORBIT/ohnrscript/packages-llvm/node.ohn/src/bindings.c"

with open(bindings_path, "r") as f:
    content = f.read()

time_func = """
#include <time.h>
int64_t sys_time_sec(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec;
}

// Creates a TCP socket. Returns fd or -1.
"""

content = content.replace("// Creates a TCP socket. Returns fd or -1.", time_func)

with open(bindings_path, "w") as f:
    f.write(content)
