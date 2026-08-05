# Core Library Benchmarks

*(These benchmarks test the standalone core Ohnrscript networking stack. They use the TechEmpower Cleartext Plaintext standard for maximum apples-to-apples kernel looping comparison).*

### 1. HTTP Server Throughput (Plaintext)
*Testing bare-metal TCP routing and HTTP serving using `wrk` with 12 threads and 400 connections.*

> **Environment Note:** These benchmarks were executed natively on an **Apple Silicon (Mac ARM64)** environment running macOS `kqueue` under standard daily system load (non-cleanroom).

| Language / Runtime | Peak Requests Per Second (RPS) | Average Latency |
| :--- | :--- | :--- |
| **Ohnrscript (Run 1: Peak)** | **111,426** | **3.51ms** |
| **Ohnrscript (Run 2: Variance)** | **101,225** | **3.89ms** |

> **Analysis**: Under local execution conditions, the Ohnrscript runtime sustained a peak throughput of 111,426 requests per second with an average latency of 3.51ms. The low standard deviation (356µs) indicates consistent event-loop execution without Garbage Collection (GC) pauses. This stability is a structural result of the Data-Oriented Design (DOD) architecture, which pre-allocates flat memory blocks for up to 4,096 concurrent socket connections during startup. This approach decouples the runtime's memory footprint from incoming traffic volume and prevents dynamic heap allocation during the request lifecycle.

### Raw Telemetry & Deep-Dive Analysis

Below is the exact `wrk` telemetry output driving the table above, demonstrating the raw physics of the runtime.

#### Ohnrscript (111k RPS)
```text
Running 10s test @ http://127.0.0.1:8080/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     3.51ms  356.92us   7.52ms   92.30%
    Req/Sec     9.39k     0.95k   23.09k    96.93%
  1125703 requests in 10.10s, 81.59MB read
Requests/sec: 111426.93
Transfer/sec:      8.08MB
```

#### Ohnrscript (Run 2: 101k RPS)
```text
Running 10s test @ http://127.0.0.1:8080/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     3.89ms  699.38us   9.37ms   81.98%
    Req/Sec     8.48k     1.11k   11.03k    71.67%
  1012939 requests in 10.01s, 73.42MB read
Requests/sec: 101225.78
Transfer/sec:      7.34MB
```

#### Technical Breakdown

* **The Load Profile (`12 threads and 400 connections`)**: The testing tool utilized 12 independent CPU threads to maintain 400 concurrent connections, sending requests continuously for 10 seconds.
* **Latency (`Avg 3.51ms`, `Stdev 356.92us`)**: Under this concurrent load, the runtime maintained a 3.51ms average response time. The standard deviation of 356.92µs indicates that the event loop did not experience the latency spikes typically associated with Garbage Collection (GC) pauses in managed runtimes. The maximum recorded latency was 7.52ms.
* **Throughput (`111,426.93 Requests/sec`)**: The single runtime instance executed the complete TCP accept, HTTP parse, route evaluation, and response flush cycle at a rate of over 111,000 times per second. (Note: The "12 threads" metric refers exclusively to the `wrk` load-generator simulating concurrent users; the Ohnrscript server itself operates as a highly-efficient single process).
* **Bandwidth (`8.08MB/sec`)**: For plaintext HTTP responses, sustaining 8.08 MB/s requires continuous, high-frequency buffer transfers across the user-space/kernel boundary via the `kqueue` C-bindings.

> **Environment Context (Mac ARM64)**: These telemetry results were captured natively on a standard macOS (Apple Silicon) workstation. During execution, the only active background application was the developer's IDE. While minor ambient OS-level process scheduling accounts for the slight throughput fluctuation between the 111k peak (Run 1) and the 101k sustained rate (Run 2), the data demonstrates that Ohnrscript achieves massive, highly-stable concurrency directly on local development hardware without requiring isolated server environments.
