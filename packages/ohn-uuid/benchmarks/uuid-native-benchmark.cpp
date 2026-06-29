#include <iostream>
#include <chrono>
#include <uuid/uuid.h>

int main() {
    const int ITERATIONS = 5000000;
    
    std::cout << "Running Native C++ Benchmark: " << ITERATIONS << " UUID generations...\n\n";

    auto start = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < ITERATIONS; ++i) {
        uuid_t out;
        uuid_generate_random(out);
        char outStr[37];
        uuid_unparse_lower(out, outStr);
        // Prevent compiler optimization
        volatile char dummy = outStr[0];
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration = end - start;

    std::cout << "--- libuuid (Native C++) ---" << std::endl;
    std::cout << "Time: " << duration.count() << " ms" << std::endl;

    return 0;
}
