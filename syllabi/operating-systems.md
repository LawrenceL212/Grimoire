<!-- GENERATED:BEGIN - import_ostep.py rewrites this block -->
# Syllabus - Operating Systems (The Kernel Depths)

Scraped from `pages.cs.wisc.edu/~remzi/OSTEP (free online, link-only)`. **Chapter map only** - no prose was imported, because OSTEP ships PDFs and the authors ask for links rather than copies.

| Floor | Name | Part | Chapters |
|---|---|---|---|
| 1 | The Threshold Gate | Intro | 1. Dialogue, 2. Introduction |
| 2 | The Hall of Mirrors I | Virtualization | 3. Dialogue, 4. Processes, 5. Process API |
| 3 | The Hall of Mirrors II | Virtualization | 6. Direct Execution, 7. CPU Scheduling, 8. Multi-level Feedback |
| 4 | The Hall of Mirrors III | Virtualization | 9. Lottery Scheduling, 10. Multi-CPU Scheduling, 11. Summary, 12. Dialogue |
| 5 | The Hall of Mirrors IV | Virtualization | 13. Address Spaces, 14. Memory API, 15. Address Translation, 16. Segmentation |
| 6 | The Hall of Mirrors V | Virtualization | 17. Free Space Management, 18. Introduction to Paging, 19. Translation Lookaside Buffers, 20. Advanced Page Tables |
| 7 | The Hall of Mirrors VI | Virtualization | 21. Swapping: Mechanisms, 22. Swapping: Policies, 23. Complete VM Systems, 24. Summary |
| 8 | The Tangled Weave I | Concurrency | 25. Dialogue, 26. Concurrency and Threads, 27. Thread API |
| 9 | The Tangled Weave II | Concurrency | 28. Locks, 29. Locked Data Structures, 30. Condition Variables |
| 10 | The Tangled Weave III | Concurrency | 31. Semaphores, 32. Concurrency Bugs, 33. Event-based Concurrency, 34. Summary |
| 11 | The Deep Archive I | Persistence | 35. Dialogue, 36. I/O Devices, 37. Hard Disk Drives |
| 12 | The Deep Archive II | Persistence | 38. Redundant Disk Arrays (RAID), 39. Files and Directories, 40. File System Implementation |
| 13 | The Deep Archive III | Persistence | 41. Fast File System (FFS), 42. FSCK and Journaling, 43. Log-structured File System (LFS) |
| 14 | The Deep Archive IV | Persistence | 44. Flash-based SSDs, 45. Data Integrity and Protection, 46. Summary, 47. Dialogue |
| 15 | The Deep Archive V | Persistence | 48. Distributed Systems, 49. Network File System (NFS), 50. Andrew File System (AFS), 51. Summary |
| 16 | The Warded Vault I | Security | 52. Dialogue, 53. Intro Security, 54. Authentication |
| 17 | The Warded Vault II | Security | 55. Access Control, 56. Cryptography, 57. Distributed |
| 18 | The Sealed Annex I | Appendices | Dialogue, Virtual Machines, Dialogue, Monitors |
| 19 | The Sealed Annex II | Appendices | Dialogue, Lab Tutorial, Systems Labs, xv6 Labs |

## Every chapter, with its PDF

- 1. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-threeeasy.pdf
- 2. Introduction - https://pages.cs.wisc.edu/~remzi/OSTEP/intro.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/intro
- 3. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-virtualization.pdf
- 4. Processes - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf
- 5. Process API - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/cpu-api
- 6. Direct Execution - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf
- 7. CPU Scheduling - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf
- 8. Multi-level Feedback - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf
- 9. Lottery Scheduling - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-lottery.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/cpu-sched-lottery
- 10. Multi-CPU Scheduling - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-multi.pdf
- 11. Summary - https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-dialogue.pdf
- 12. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-vm.pdf
- 13. Address Spaces - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/vm-intro
- 14. Memory API - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-api.pdf
- 15. Address Translation - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-mechanism.pdf
- 16. Segmentation - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-segmentation.pdf
- 17. Free Space Management - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-freespace.pdf
- 18. Introduction to Paging - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf
- 19. Translation Lookaside Buffers - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf
- 20. Advanced Page Tables - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf
- 21. Swapping: Mechanisms - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf
- 22. Swapping: Policies - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf
- 23. Complete VM Systems - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-complete.pdf
- 24. Summary - https://pages.cs.wisc.edu/~remzi/OSTEP/vm-dialogue.pdf
- 25. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-concurrency.pdf
- 26. Concurrency and Threads - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/threads-intro
- 27. Thread API - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-api.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/threads-api
- 28. Locks - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/threads-locks
- 29. Locked Data Structures - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks-usage.pdf
- 30. Condition Variables - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/threads-cv
- 31. Semaphores - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf - code: https://github.com/remzi-arpacidusseau/ostep-code/tree/master/threads-sema
- 32. Concurrency Bugs - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf
- 33. Event-based Concurrency - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-events.pdf
- 34. Summary - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-dialogue.pdf
- 35. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-persistence.pdf
- 36. I/O Devices - https://pages.cs.wisc.edu/~remzi/OSTEP/file-devices.pdf
- 37. Hard Disk Drives - https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf
- 38. Redundant Disk Arrays (RAID) - https://pages.cs.wisc.edu/~remzi/OSTEP/file-raid.pdf
- 39. Files and Directories - https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf
- 40. File System Implementation - https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf
- 41. Fast File System (FFS) - https://pages.cs.wisc.edu/~remzi/OSTEP/file-ffs.pdf
- 42. FSCK and Journaling - https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf
- 43. Log-structured File System (LFS) - https://pages.cs.wisc.edu/~remzi/OSTEP/file-lfs.pdf
- 44. Flash-based SSDs - https://pages.cs.wisc.edu/~remzi/OSTEP/file-ssd.pdf
- 45. Data Integrity and Protection - https://pages.cs.wisc.edu/~remzi/OSTEP/file-integrity.pdf
- 46. Summary - https://pages.cs.wisc.edu/~remzi/OSTEP/file-dialogue.pdf
- 47. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-distribution.pdf
- 48. Distributed Systems - https://pages.cs.wisc.edu/~remzi/OSTEP/dist-intro.pdf
- 49. Network File System (NFS) - https://pages.cs.wisc.edu/~remzi/OSTEP/dist-nfs.pdf
- 50. Andrew File System (AFS) - https://pages.cs.wisc.edu/~remzi/OSTEP/dist-afs.pdf
- 51. Summary - https://pages.cs.wisc.edu/~remzi/OSTEP/dist-dialogue.pdf
- 52. Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-security.pdf
- 53. Intro Security - https://pages.cs.wisc.edu/~remzi/OSTEP/security-intro.pdf
- 54. Authentication - https://pages.cs.wisc.edu/~remzi/OSTEP/security-authentication.pdf
- 55. Access Control - https://pages.cs.wisc.edu/~remzi/OSTEP/security-access.pdf
- 56. Cryptography - https://pages.cs.wisc.edu/~remzi/OSTEP/security-crypto.pdf
- 57. Distributed - https://pages.cs.wisc.edu/~remzi/OSTEP/security-distributed.pdf
- Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-vmm.pdf
- Virtual Machines - https://pages.cs.wisc.edu/~remzi/OSTEP/vmm-intro.pdf
- Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-monitors.pdf
- Monitors - https://pages.cs.wisc.edu/~remzi/OSTEP/threads-monitors.pdf
- Dialogue - https://pages.cs.wisc.edu/~remzi/OSTEP/dialogue-labs.pdf
- Lab Tutorial - https://pages.cs.wisc.edu/~remzi/OSTEP/lab-tutorial.pdf
- Systems Labs - https://pages.cs.wisc.edu/~remzi/OSTEP/lab-projects-systems.pdf
- xv6 Labs - https://pages.cs.wisc.edu/~remzi/OSTEP/lab-projects-xv6.pdf

## Still to author

- lesson prose for every chapter above (nothing was imported)
- practice challenges (none imported)
- exam questions (none imported)
<!-- GENERATED:END -->

<!-- GENERATED:BEGIN - import_jwasham.py rewrites this block -->
# Syllabus - Operating Systems

Derived from `jwasham/coding-interview-university (CC BY-SA 4.0)`, `README.md`. This is the contract: content must cover everything listed here.

Topic wording is the upstream checklist, verbatim. Resource links are **counted, not copied** - the videos and articles behind them belong to their own authors, so follow the section links below to reach them. No lesson prose comes from this source: `import_jwasham.py` writes syllabi only, never `content/*.json`.

**Upstream sections routed here**

- [`Even More Knowledge`](https://github.com/jwasham/coding-interview-university#even-more-knowledge) - 18 topics
- [`Additional Learning`](https://github.com/jwasham/coding-interview-university#additional-learning) - 20 topics

| # | Section | Group | Topic | Sub-topics | Links |
|---|---|---|---|---|---|
| 1 | Even More Knowledge | How computers process a program | How CPU executes a program (video) | - | 1 |
| 2 | Even More Knowledge | How computers process a program | How computers calculate - ALU (video) | - | 1 |
| 3 | Even More Knowledge | How computers process a program | Registers and RAM (video) | - | 1 |
| 4 | Even More Knowledge | How computers process a program | The Central Processing Unit (CPU) (video) | - | 1 |
| 5 | Even More Knowledge | How computers process a program | Instructions and Programs (video) | - | 1 |
| 6 | Even More Knowledge | Caches | LRU cache | The Magic of LRU Cache (100 Days of Google Dev) (video); Implementing LRU (video); LeetCode - 146 LRU Cache (C++) (video) | 3 |
| 7 | Even More Knowledge | Caches | CPU cache | MIT 6.004 L15: The Memory Hierarchy (video); MIT 6.004 L16: Cache Issues (video) | 2 |
| 8 | Even More Knowledge | Processes and Threads | Computer Science 162 - Operating Systems (25 videos) | for processes and threads see videos 1-11; Operating Systems and System Programming (video) | 1 |
| 9 | Even More Knowledge | Processes and Threads | Covers | Processes, Threads, Concurrency issues; CPU activity, interrupts, context switching; Modern concurrency constructs with multicore processors; Paging, segmentation, and virtual memory (video); Interrupts (video); Process resource needs (memory: code, static storage, stack, heap,...; Thread resource needs (shares above (minus stack) with other threads...; Forking is really copy on write (read-only) until the new process...; +1 more | 3 |
| 10 | Even More Knowledge | Processes and Threads | threads in C++ (series - 10 videos) | - | 1 |
| 11 | Even More Knowledge | Processes and Threads | CS 377 Spring '14: Operating Systems from University of Massachusetts | - | 1 |
| 12 | Even More Knowledge | Processes and Threads | concurrency in Python (videos) | Short series on threads; Python Threads; Understanding the Python GIL (2010); David Beazley - Python Concurrency From the Ground Up LIVE! - PyCon 2015; Keynote David Beazley - Topics of Interest (Python Asyncio); Mutex in Python | 7 |
| 13 | Even More Knowledge | Floating Point Numbers | simple 8-bit: Representation of Floating Point Numbers - 1 (video - there is an error in calculations - see video description) | - | 1 |
| 14 | Even More Knowledge | Unicode | The Absolute Minimum Every Software Developer Absolutely, Positively Must Know About Unicode and Character Sets | - | 1 |
| 15 | Even More Knowledge | Unicode | What Every Programmer Absolutely, Positively Needs To Know About Encodings And Character Sets To Work With Text | - | 1 |
| 16 | Even More Knowledge | Endianness | Big And Little Endian | - | 1 |
| 17 | Even More Knowledge | Endianness | Big Endian Vs Little Endian (video) | - | 1 |
| 18 | Even More Knowledge | Endianness | Big And Little Endian Inside/Out (video) | Very technical talk for kernel devs. Don't worry if most is over...; The first half is enough. | 1 |
| 19 | Additional Learning | Compilers | How a Compiler Works in ~1 minute (video) | - | 1 |
| 20 | Additional Learning | Compilers | Harvard CS50 - Compilers (video) | - | 1 |
| 21 | Additional Learning | Compilers | C++ (video) | - | 1 |
| 22 | Additional Learning | Compilers | Understanding Compiler Optimization (C++) (video) | - | 1 |
| 23 | Additional Learning | Unix/Linux command line tools | I filled in the list below from good tools. | - | 0 |
| 24 | Additional Learning | Unix/Linux command line tools | bash | - | 0 |
| 25 | Additional Learning | Unix/Linux command line tools | cat | - | 0 |
| 26 | Additional Learning | Unix/Linux command line tools | grep | - | 0 |
| 27 | Additional Learning | Unix/Linux command line tools | sed | - | 0 |
| 28 | Additional Learning | Unix/Linux command line tools | awk | - | 0 |
| 29 | Additional Learning | Unix/Linux command line tools | curl or wget | - | 0 |
| 30 | Additional Learning | Unix/Linux command line tools | sort | - | 0 |
| 31 | Additional Learning | Unix/Linux command line tools | tr | - | 0 |
| 32 | Additional Learning | Unix/Linux command line tools | uniq | - | 0 |
| 33 | Additional Learning | Unix/Linux command line tools | strace | - | 1 |
| 34 | Additional Learning | Unix/Linux command line tools | tcpdump | - | 1 |
| 35 | Additional Learning | Unix/Linux command line tools | Essential Linux Commands Tutorial | - | 1 |
| 36 | Additional Learning | Garbage collection | GC in Python (video) | - | 1 |
| 37 | Additional Learning | Garbage collection | Deep Dive Java: Garbage Collection is Good! | - | 1 |
| 38 | Additional Learning | Garbage collection | Deep Dive Python: Garbage Collection in CPython (video) | - | 1 |

**Coverage:** 38 topics, 36 sub-topics, 39 linked resources upstream.

**Read the topic column with care.** 22 of the 38 rows (58%) are the title of a linked video or article, because that is what upstream lists where a concept name would go ("HTTP (video)", "Khan Academy"). They are kept verbatim rather than reworded into concepts, which would be inventing curriculum. Name the real concept when mapping these to floors, and do not read the row count as a count of distinct concepts.

## Still to do

- Topics above are **not yet mapped to floors**. Grouping and ordering them into floors is an authoring decision.
- No lesson text, practice or exam content exists for this dungeon, and this source cannot supply any: it is an index of links. Teaching text must be written, or imported from a source whose licence allows embedding.
<!-- GENERATED:END -->
