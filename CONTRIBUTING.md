# Contributing to Ohnrscript

Thank you for your interest in contributing to Ohnrscript! 

Because Ohnrscript is licensed under the **Business Source License 1.1 (BUSL)**, we have strict guidelines to protect the intellectual property, commercial licensing capabilities, and the future transition of the codebase to the MPL-2.0 open-source license. 

Please read this document carefully before opening an Issue or Pull Request.

> [!WARNING]
> By submitting a Pull Request, you agree that your contribution is subject to our Contributor License Agreement (CLA). We cannot accept any code without a signed CLA.

## 1. Contributor License Agreement (CLA)

To ensure that the Ohnrscript Authors can legally re-license the software for commercial enterprise customers and seamlessly transition the codebase to MPL-2.0 on the Change Date, **we must retain clear copyright governance over the entire codebase.**

When you submit your first Pull Request, our automated CLA bot will prompt you to sign the Ohnrscript CLA. This agreement grants the Licensor an irrevocable, broad license to use, modify, and commercialize your contribution.

## 2. The "Clean Room" Rule (No Copyleft Code)

Ohnrscript is a proprietary systems language. **You must not submit any code that you did not write yourself.**

> [!CAUTION]
> Under no circumstances may you copy, adapt, or include code licensed under the GPL, AGPL, LGPL, or any other copyleft license. Incorporating copyleft code into Ohnrscript is a strict violation of our licensing model. 

If you are porting an algorithm or data structure, you must write it from scratch (Clean Room design) or ensure it is sourced from a strict MIT/Apache-2.0 origin, and you must explicitly state the origin in your Pull Request.

## 3. The Contribution Workflow

To prevent wasted effort on your part, please follow this strict workflow:

### A. Discuss Before Coding (Issue-First Policy)
We do not accept "drive-by" Pull Requests for new features, architectural changes, or standard library additions. 
* You **must** open an Issue detailing the proposed change.
* A Core Maintainer must explicitly approve the Issue and assign it a `Status: Accepted` label before you begin writing code.

### B. Bug Fixes
Small bug fixes (e.g., typos, obvious logic errors, segmentation faults) do not require prior discussion. You may open a PR directly. Please include a reproducible test case.

### C. Code Review & Merging
* Only designated Core Maintainers have commit access to the repository.
* Every PR requires approval from at least one Core Maintainer.
* Your code must pass all automated CI checks (formatting, tests, LLVM IR validation).

## 4. Setting up your Environment

If your Issue has been accepted, follow the [Developer Guide](developer_guide.md) to set up your local compiler chain. 

## 5. Community & Conduct

While Ohnrscript is proprietary software, our community spans researchers, indie developers, and enterprise clients. We expect all interactions in Issues and Pull Requests to remain strictly professional, courteous, and highly technical.

---
*By contributing to Ohnrscript, you are helping build the fastest dual-target systems language in the world. We appreciate your dedication to the craft.*
