<!-- GENERATED:BEGIN - import_jwasham.py rewrites this block -->
# Syllabus - Algorithms & Complexity

Derived from `jwasham/coding-interview-university (CC BY-SA 4.0)`, `README.md`. This is the contract: content must cover everything listed here.

Topic wording is the upstream checklist, verbatim. Resource links are **counted, not copied** - the videos and articles behind them belong to their own authors, so follow the section links below to reach them. No lesson prose comes from this source: `import_jwasham.py` writes syllabi only, never `content/*.json`.

**Upstream sections routed here**

- [`Algorithmic complexity / Big-O / Asymptotic analysis`](https://github.com/jwasham/coding-interview-university#algorithmic-complexity--big-o--asymptotic-analysis) - 9 topics
- [`More Knowledge`](https://github.com/jwasham/coding-interview-university#more-knowledge) - 12 topics
- [`Sorting`](https://github.com/jwasham/coding-interview-university#sorting) - 16 topics
- [`Graphs`](https://github.com/jwasham/coding-interview-university#graphs) - 6 topics
- [`Even More Knowledge`](https://github.com/jwasham/coding-interview-university#even-more-knowledge) - 20 topics
- [`Additional Learning`](https://github.com/jwasham/coding-interview-university#additional-learning) - 22 topics
- [`Additional Detail on Some Subjects`](https://github.com/jwasham/coding-interview-university#additional-detail-on-some-subjects) - 19 topics

`## Graphs` upstream mixes representations with traversal and shortest-path algorithms, so it is listed in both `data-structures.md` and `algorithms.md`. Teach it once, and decide when authoring which dungeon owns it.

| # | Section | Group | Topic | Sub-topics | Links |
|---|---|---|---|---|---|
| 1 | Algorithmic complexity / Big-O / Asymptotic analysis | - | Harvard CS50 - Asymptotic Notation (video) | - | 1 |
| 2 | Algorithmic complexity / Big-O / Asymptotic analysis | - | Big O Notations (general quick tutorial) (video) | - | 1 |
| 3 | Algorithmic complexity / Big-O / Asymptotic analysis | - | Big O Notation (and Omega and Theta) - best mathematical explanation (video) | - | 1 |
| 4 | Algorithmic complexity / Big-O / Asymptotic analysis | - | Skiena (video) | - | 1 |
| 5 | Algorithmic complexity / Big-O / Asymptotic analysis | - | UC Berkeley Big O (video) | - | 1 |
| 6 | Algorithmic complexity / Big-O / Asymptotic analysis | - | Amortized Analysis (video) | - | 1 |
| 7 | Algorithmic complexity / Big-O / Asymptotic analysis | - | TopCoder (includes recurrence relations and master theorem) | Computational Complexity: Section 1; Computational Complexity: Section 2 | 2 |
| 8 | Algorithmic complexity / Big-O / Asymptotic analysis | - | Cheat sheet | - | 1 |
| 9 | Algorithmic complexity / Big-O / Asymptotic analysis | - | [Review] Analyzing Algorithms (playlist) in 18 minutes (video) | - | 1 |
| 10 | More Knowledge | Binary search | Binary Search (video) | - | 1 |
| 11 | More Knowledge | Binary search | Binary Search (video) | - | 1 |
| 12 | More Knowledge | Binary search | detail | - | 1 |
| 13 | More Knowledge | Binary search | blueprint | - | 1 |
| 14 | More Knowledge | Binary search | [Review] Binary search in 4 minutes (video) | - | 1 |
| 15 | More Knowledge | Binary search | Implement | binary search (on a sorted array of integers); binary search using recursion | 0 |
| 16 | More Knowledge | Bitwise operations | Bits cheat sheet | you should know many of the powers of 2 from (2^1 to 2^16 and 2^32) | 1 |
| 17 | More Knowledge | Bitwise operations | Get a really good understanding of manipulating bits with: &, \|, ^, ~, >>, << | words; Good intro; C Programming Tutorial 2-10: Bitwise Operators (video); Bit Manipulation; Bitwise Operation; Bithacks; The Bit Twiddler; The Bit Twiddler Interactive; +2 more | 10 |
| 18 | More Knowledge | Bitwise operations | 2s and 1s complement | Binary: Plusses & Minuses (Why We Use Two's Complement) (video); 1s Complement; 2s Complement | 3 |
| 19 | More Knowledge | Bitwise operations | Count set bits | 4 ways to count bits in a byte (video); Count Bits; How To Count The Number Of Set Bits In a 32 Bit Integer | 3 |
| 20 | More Knowledge | Bitwise operations | Swap values | Swap | 1 |
| 21 | More Knowledge | Bitwise operations | Absolute value | Absolute Integer | 1 |
| 22 | Sorting | - | Notes | Implement sorts & know best case/worst case, average complexity of each; Stability in sorting algorithms ("Is Quicksort stable?"); Which algorithms can be used on linked lists? Which on arrays? Which... | 5 |
| 23 | Sorting | - | Sedgewick - Mergesort (5 videos) | 1. Mergesort; 2. Bottom-up Mergesort; 3. Sorting Complexity; 4. Comparators; 5. Stability | 6 |
| 24 | Sorting | - | Sedgewick - Quicksort (4 videos) | 1. Quicksort; 2. Selection; 3. Duplicate Keys; 4. System Sorts | 5 |
| 25 | Sorting | - | UC Berkeley | CS 61B Lecture 29: Sorting I (video); CS 61B Lecture 30: Sorting II (video); CS 61B Lecture 32: Sorting III (video); CS 61B Lecture 33: Sorting V (video); CS 61B 2014-04-21: Radix Sort(video) | 5 |
| 26 | Sorting | - | Bubble Sort (video) | - | 1 |
| 27 | Sorting | - | Analyzing Bubble Sort (video) | - | 1 |
| 28 | Sorting | - | Insertion Sort, Merge Sort (video) | - | 1 |
| 29 | Sorting | - | Insertion Sort (video) | - | 1 |
| 30 | Sorting | - | Merge Sort (video) | - | 1 |
| 31 | Sorting | - | Quicksort (video) | - | 1 |
| 32 | Sorting | - | Selection Sort (video) | - | 1 |
| 33 | Sorting | - | Merge sort code | Using output array (C); Using output array (Python); In-place (C++) | 3 |
| 34 | Sorting | - | Quick sort code | Implementation (C); Implementation (C); Implementation (Python) | 3 |
| 35 | Sorting | - | [Review] Sorting (playlist) in 18 minutes | Quick sort in 4 minutes (video); Heap sort in 4 minutes (video); Merge sort in 3 minutes (video); Bubble sort in 2 minutes (video); Selection sort in 3 minutes (video); Insertion sort in 2 minutes (video) | 7 |
| 36 | Sorting | - | Implement | Mergesort: O(n log n) average and worst case; Quicksort O(n log n) average case; Selection sort and insertion sort are both O(n^2) average and worst-case; For heapsort, see Heap data structure above | 0 |
| 37 | Sorting | - | Not required, but I recommended them | Sedgewick - Radix Sorts (6 videos); Radix Sort; Radix Sort (video); Radix Sort, Counting Sort (linear time given constraints) (video); Randomization: Matrix Multiply, Quicksort, Freivalds' algorithm (video); Sorting in Linear Time (video) | 12 |
| 38 | Graphs | - | Notes | There are 4 basic ways to represent a graph in memory; Familiarize yourself with each representation and its pros & cons; BFS and DFS - know their computational complexity, their trade-offs,...; When asked a question, look for a graph-based solution first, then... | 0 |
| 39 | Graphs | - | MIT(videos) | Breadth-First Search; Depth-First Search | 2 |
| 40 | Graphs | - | Skiena Lectures - great intro | CSE373 2020 - Lecture 10 - Graph Data Structures (video); CSE373 2020 - Lecture 11 - Graph Traversal (video); CSE373 2020 - Lecture 12 - Depth First Search (video); CSE373 2020 - Lecture 13 - Minimum Spanning Trees (video); CSE373 2020 - Lecture 14 - Minimum Spanning Trees (con't) (video); CSE373 2020 - Lecture 15 - Graph Algorithms (con't 2) (video) | 6 |
| 41 | Graphs | - | Graphs (review and more) | 6.006 Single-Source Shortest Paths Problem (video); 6.006 Dijkstra (video); 6.006 Bellman-Ford (video); 6.006 Speeding Up Dijkstra (video); Aduni: Graph Algorithms I - Topological Sorting, Minimum Spanning...; Aduni: Graph Algorithms II - DFS, BFS, Kruskal's Algorithm, Union...; Aduni: Graph Algorithms III: Shortest Path - Lecture 8 (video); Aduni: Graph Alg. IV: Intro to geometric algorithms - Lecture 9 (video); +5 more | 13 |
| 42 | Graphs | - | Full Coursera Course | Algorithms on Graphs (video) | 1 |
| 43 | Graphs | - | I'll implement | DFS with adjacency list (recursive); DFS with adjacency list (iterative with stack); DFS with adjacency matrix (recursive); DFS with adjacency matrix (iterative with stack); BFS with adjacency list; BFS with adjacency matrix; single-source shortest path (Dijkstra); minimum spanning tree; +1 more | 0 |
| 44 | Even More Knowledge | Recursion | Stanford lectures on recursion & backtracking | Lecture 8 \| Programming Abstractions (video); Lecture 9 \| Programming Abstractions (video); Lecture 10 \| Programming Abstractions (video); Lecture 11 \| Programming Abstractions (video) | 4 |
| 45 | Even More Knowledge | Recursion | How is tail recursion better than not? | What Is Tail Recursion Why Is It So Bad?; Tail Recursion (video) | 2 |
| 46 | Even More Knowledge | Recursion | 5 Simple Steps for Solving Any Recursive Problem(video) | - | 3 |
| 47 | Even More Knowledge | Dynamic Programming | Videos | Skiena: CSE373 2020 - Lecture 19 - Introduction to Dynamic...; Skiena: CSE373 2020 - Lecture 20 - Edit Distance (video); Skiena: CSE373 2020 - Lecture 20 - Edit Distance (continued) (video); Skiena: CSE373 2020 - Lecture 21 - Dynamic Programming (video); Skiena: CSE373 2020 - Lecture 22 - Dynamic Programming and Review...; Simonson: Dynamic Programming 0 (starts at 59:18) (video); Simonson: Dynamic Programming I - Lecture 11 (video); Simonson: Dynamic programming II - Lecture 12 (video); +1 more | 9 |
| 48 | Even More Knowledge | Dynamic Programming | Yale Lecture notes | Dynamic Programming | 1 |
| 49 | Even More Knowledge | Dynamic Programming | Coursera | The RNA secondary structure problem (video); A dynamic programming algorithm (video); Illustrating the DP algorithm (video); Running time of the DP algorithm (video); DP vs. recursive implementation (video); Global pairwise sequence alignment (video); Local pairwise sequence alignment (video) | 7 |
| 50 | Even More Knowledge | Combinatorics (n choose k) & Probability | Math Skills: How to find Factorial, Permutation, and Combination (Choose) (video) | - | 1 |
| 51 | Even More Knowledge | Combinatorics (n choose k) & Probability | Make School: Probability (video) | - | 1 |
| 52 | Even More Knowledge | Combinatorics (n choose k) & Probability | Make School: More Probability and Markov Chains (video) | - | 1 |
| 53 | Even More Knowledge | Combinatorics (n choose k) & Probability | Khan Academy | Course layout; Just the videos - 41 (each are simple and each are short) | 2 |
| 54 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Computational Complexity (video) | - | 1 |
| 55 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Simonson | Greedy Algs. II & Intro to NP-Completeness (video); NP Completeness II & Reductions (video); NP Completeness III (Video); NP Completeness IV (video) | 4 |
| 56 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Skiena | CSE373 2020 - Lecture 23 - NP-Completeness (video); CSE373 2020 - Lecture 24 - Satisfiability (video); CSE373 2020 - Lecture 25 - More NP-Completeness (video); CSE373 2020 - Lecture 26 - NP-Completeness Challenge (video) | 4 |
| 57 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Complexity: P, NP, NP-completeness, Reductions (video) | - | 1 |
| 58 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Complexity: Approximation Algorithms (video) | - | 1 |
| 59 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Complexity: Fixed-Parameter Algorithms (video) | - | 1 |
| 60 | Even More Knowledge | NP, NP-Complete and Approximation Algorithms | Peter Norvig discusses near-optimal solutions to the traveling salesman problem | Jupyter Notebook | 1 |
| 61 | Even More Knowledge | String searching & manipulations | Sedgewick - Suffix Arrays (video) | - | 1 |
| 62 | Even More Knowledge | String searching & manipulations | Sedgewick - Substring Search (videos) | 1. Introduction to Substring Search; 2. Brute-Force Substring Search; 3. Knuth-Morris Pratt; 4. Boyer-Moore; 5. Rabin-Karp | 6 |
| 63 | Even More Knowledge | String searching & manipulations | Search pattern in a text (video) | - | 1 |
| 64 | Additional Learning | A* | A Search Algorithm | - | 1 |
| 65 | Additional Learning | A* | A* Pathfinding (E01: algorithm explanation) (video) | - | 1 |
| 66 | Additional Learning | Fast Fourier Transform | An Interactive Guide To The Fourier Transform | - | 1 |
| 67 | Additional Learning | Fast Fourier Transform | What is a Fourier transform? What is it used for? | - | 1 |
| 68 | Additional Learning | Fast Fourier Transform | What is the Fourier Transform? (video) | - | 1 |
| 69 | Additional Learning | Fast Fourier Transform | Divide & Conquer: FFT (video) | - | 1 |
| 70 | Additional Learning | Fast Fourier Transform | Understanding The FFT | - | 1 |
| 71 | Additional Learning | Network Flows | Ford-Fulkerson in 5 minutes — Step by step example (video) | - | 1 |
| 72 | Additional Learning | Network Flows | Ford-Fulkerson Algorithm (video) | - | 1 |
| 73 | Additional Learning | Network Flows | Network Flows (video) | - | 1 |
| 74 | Additional Learning | Math for Fast Processing | Integer Arithmetic, Karatsuba Multiplication (video) | - | 1 |
| 75 | Additional Learning | Math for Fast Processing | The Chinese Remainder Theorem (used in cryptography) (video) | - | 1 |
| 76 | Additional Learning | Linear Programming (videos) | Linear Programming | - | 1 |
| 77 | Additional Learning | Linear Programming (videos) | Finding minimum cost | - | 1 |
| 78 | Additional Learning | Linear Programming (videos) | Finding maximum value | - | 1 |
| 79 | Additional Learning | Linear Programming (videos) | Solve Linear Equations with Python - Simplex Algorithm | - | 1 |
| 80 | Additional Learning | Geometry, Convex hull (videos) | Graph Alg. IV: Intro to geometric algorithms - Lecture 9 | - | 1 |
| 81 | Additional Learning | Geometry, Convex hull (videos) | Geometric Algorithms: Graham & Jarvis - Lecture 10 | - | 1 |
| 82 | Additional Learning | Geometry, Convex hull (videos) | Divide & Conquer: Convex Hull, Median Finding | - | 1 |
| 83 | Additional Learning | Discrete math | Computer Science 70, 001 - Spring 2015 - Discrete Mathematics and Probability Theory | - | 1 |
| 84 | Additional Learning | Discrete math | Discrete Mathematics by Shai Simonson (19 videos) | - | 1 |
| 85 | Additional Learning | Discrete math | Discrete Mathematics By IIT Ropar NPTEL | - | 1 |
| 86 | Additional Detail on Some Subjects | More Dynamic Programming | 6.006: Dynamic Programming I: Fibonacci, Shortest Paths | - | 1 |
| 87 | Additional Detail on Some Subjects | More Dynamic Programming | 6.006: Dynamic Programming II: Text Justification, Blackjack | - | 1 |
| 88 | Additional Detail on Some Subjects | More Dynamic Programming | 6.006: DP III: Parenthesization, Edit Distance, Knapsack | - | 1 |
| 89 | Additional Detail on Some Subjects | More Dynamic Programming | 6.006: DP IV: Guitar Fingering, Tetris, Super Mario Bros. | - | 1 |
| 90 | Additional Detail on Some Subjects | More Dynamic Programming | 6.046: Dynamic Programming & Advanced DP | - | 1 |
| 91 | Additional Detail on Some Subjects | More Dynamic Programming | 6.046: Dynamic Programming: All-Pairs Shortest Paths | - | 1 |
| 92 | Additional Detail on Some Subjects | More Dynamic Programming | 6.046: Dynamic Programming (student recitation) | - | 1 |
| 93 | Additional Detail on Some Subjects | Advanced Graph Processing | Synchronous Distributed Algorithms: Symmetry-Breaking. Shortest-Paths Spanning Trees | - | 1 |
| 94 | Additional Detail on Some Subjects | Advanced Graph Processing | Asynchronous Distributed Algorithms: Shortest-Paths Spanning Trees | - | 1 |
| 95 | Additional Detail on Some Subjects | Advanced Graph Processing | MIT **Probability** (mathy, and go slowly, which is good for mathy things) (videos) | MIT 6.042J - Probability Introduction; MIT 6.042J - Conditional Probability; MIT 6.042J - Independence; MIT 6.042J - Random Variables; MIT 6.042J - Expectation I; MIT 6.042J - Expectation II; MIT 6.042J - Large Deviations; MIT 6.042J - Random Walks | 8 |
| 96 | Additional Detail on Some Subjects | Advanced Graph Processing | Simonson: Approximation Algorithms (video) | - | 1 |
| 97 | Additional Detail on Some Subjects | String Matching | Rabin-Karp (videos) | Rabin Karps Algorithm; Precomputing; Optimization: Implementation and Analysis; Table Doubling, Karp-Rabin; Rolling Hashes, Amortized Analysis | 5 |
| 98 | Additional Detail on Some Subjects | String Matching | Knuth-Morris-Pratt (KMP) | TThe Knuth-Morris-Pratt (KMP) String Matching Algorithm | 1 |
| 99 | Additional Detail on Some Subjects | String Matching | Boyer–Moore string search algorithm | Boyer-Moore String Search Algorithm; Advanced String Searching Boyer-Moore-Horspool Algorithms (video) | 2 |
| 100 | Additional Detail on Some Subjects | String Matching | Coursera: Algorithms on Strings | starts off great, but by the time it gets past KMP it gets more...; nice explanation of tries; can be skipped | 1 |
| 101 | Additional Detail on Some Subjects | Sorting | Stanford lectures on sorting | Lecture 15 \| Programming Abstractions (video); Lecture 16 \| Programming Abstractions (video) | 2 |
| 102 | Additional Detail on Some Subjects | Sorting | Shai Simonson | Algorithms - Sorting - Lecture 2 (video); Algorithms - Sorting II - Lecture 3 (video) | 2 |
| 103 | Additional Detail on Some Subjects | Sorting | Steven Skiena lectures on sorting | CSE373 2020 - Mergesort/Quicksort (video); CSE373 2020 - Linear Sorting (video) | 2 |
| 104 | Additional Detail on Some Subjects | Sorting | NAND To Tetris: Build a Modern Computer from First Principles | - | 1 |

**Coverage:** 104 topics, 185 sub-topics, 217 linked resources upstream.

**Read the topic column with care.** 68 of the 104 rows (65%) are the title of a linked video or article, because that is what upstream lists where a concept name would go ("HTTP (video)", "Khan Academy"). They are kept verbatim rather than reworded into concepts, which would be inventing curriculum. Name the real concept when mapping these to floors, and do not read the row count as a count of distinct concepts.

## Still to do

- Topics above are **not yet mapped to floors**. Grouping and ordering them into floors is an authoring decision.
- No lesson text, practice or exam content exists for this dungeon, and this source cannot supply any: it is an index of links. Teaching text must be written, or imported from a source whose licence allows embedding.
<!-- GENERATED:END -->
