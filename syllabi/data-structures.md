<!-- GENERATED:BEGIN - import_jwasham.py rewrites this block -->
# Syllabus - Data Structures

Derived from `jwasham/coding-interview-university (CC BY-SA 4.0)`, `README.md`. This is the contract: content must cover everything listed here.

Topic wording is the upstream checklist, verbatim. Resource links are **counted, not copied** - the videos and articles behind them belong to their own authors, so follow the section links below to reach them. No lesson prose comes from this source: `import_jwasham.py` writes syllabi only, never `content/*.json`.

**Upstream sections routed here**

- [`Data Structures`](https://github.com/jwasham/coding-interview-university#data-structures) - 23 topics
- [`Trees`](https://github.com/jwasham/coding-interview-university#trees) - 26 topics
- [`Graphs`](https://github.com/jwasham/coding-interview-university#graphs) - 6 topics
- [`Even More Knowledge`](https://github.com/jwasham/coding-interview-university#even-more-knowledge) - 7 topics
- [`Additional Learning`](https://github.com/jwasham/coding-interview-university#additional-learning) - 36 topics
- [`Additional Detail on Some Subjects`](https://github.com/jwasham/coding-interview-university#additional-detail-on-some-subjects) - 6 topics

`## Graphs` upstream mixes representations with traversal and shortest-path algorithms, so it is listed in both `data-structures.md` and `algorithms.md`. Teach it once, and decide when authoring which dungeon owns it.

| # | Section | Group | Topic | Sub-topics | Links |
|---|---|---|---|---|---|
| 1 | Data Structures | Arrays | About Arrays | Arrays CS50 Harvard University; Arrays (video); UC Berkeley CS61B - Linear and Multi-Dim Arrays (video) (Start...; Dynamic Arrays (video); Jagged Arrays (video) | 5 |
| 2 | Data Structures | Arrays | Implement a vector (mutable array with automatic resizing) | Practice coding using arrays and pointers, and pointer math to jump...; New raw data array with allocated memory; size() - number of items; capacity() - number of items it can hold; is_empty(); at(index) - returns the item at a given index, blows up if index out...; push(item); insert(index, item) - inserts item at index, shifts that index's...; +6 more | 0 |
| 3 | Data Structures | Arrays | Time | O(1) to add/remove at end (amortized for allocations for more...; O(n) to insert/remove elsewhere | 0 |
| 4 | Data Structures | Arrays | Space | contiguous in memory, so proximity helps performance; space needed = (array capacity, which is >= n) * size of item, but... | 0 |
| 5 | Data Structures | Linked Lists | Description | Linked Lists CS50 Harvard University - this builds the intuition.; Singly Linked Lists (video); CS 61B - Linked Lists 1 (video); CS 61B - Linked Lists 2 (video); [Review] Linked lists in 4 minutes (video) | 5 |
| 6 | Data Structures | Linked Lists | C Code (video) | not the whole video, just portions about Node struct and memory... | 1 |
| 7 | Data Structures | Linked Lists | Linked List vs Arrays | Core Linked Lists Vs Arrays (video); In The Real World Linked Lists Vs Arrays (video) | 2 |
| 8 | Data Structures | Linked Lists | Why you should avoid linked lists (video) | - | 1 |
| 9 | Data Structures | Linked Lists | Gotcha: you need pointer to pointer knowledge | Pointers to Pointers | 1 |
| 10 | Data Structures | Linked Lists | Implement (I did with tail pointer & without) | size() - returns the number of data elements in the list; empty() - bool returns true if empty; value_at(index) - returns the value of the nth item (starting at 0...; push_front(value) - adds an item to the front of the list; pop_front() - remove the front item and return its value; push_back(value) - adds an item at the end; pop_back() - removes end item and returns its value; front() - get the value of the front item; +6 more | 0 |
| 11 | Data Structures | Linked Lists | Doubly-linked List | Description (video); No need to implement | 1 |
| 12 | Data Structures | Stack | Stacks (video) | - | 1 |
| 13 | Data Structures | Stack | [Review] Stacks in 3 minutes (video) | - | 1 |
| 14 | Data Structures | Stack | Will not implement. Implementing with the array is trivial | - | 0 |
| 15 | Data Structures | Queue | Queue (video) | - | 1 |
| 16 | Data Structures | Queue | Circular buffer/FIFO | - | 1 |
| 17 | Data Structures | Queue | [Review] Queues in 3 minutes (video) | - | 1 |
| 18 | Data Structures | Queue | Implement using linked-list, with tail pointer | enqueue(value) - adds value at a position at the tail; dequeue() - returns value and removes least recently added element...; empty() | 0 |
| 19 | Data Structures | Queue | Implement using a fixed-sized array | enqueue(value) - adds item at end of available storage; dequeue() - returns value and removes least recently added element; empty(); full() | 0 |
| 20 | Data Structures | Queue | Cost | a bad implementation using a linked list where you enqueue at the...; enqueue: O(1) (amortized, linked list and array [probing]); dequeue: O(1) (linked list and array); empty: O(1) (linked list and array) | 0 |
| 21 | Data Structures | Hash table | Videos | Hashing with Chaining (video); Table Doubling, Karp-Rabin (video); Open Addressing, Cryptographic Hashing (video); PyCon 2010: The Mighty Dictionary (video); PyCon 2017: The Dictionary Even Mightier (video); (Advanced) Randomization: Universal & Perfect Hashing (video); (Advanced) Perfect hashing (video); [Review] Hash tables in 4 minutes (video) | 8 |
| 22 | Data Structures | Hash table | Online Courses | Core Hash Tables (video); Data Structures (video); Phone Book Problem (video); distributed hash tables | 5 |
| 23 | Data Structures | Hash table | Implement with array using linear probing | hash(k, m) - m is the size of the hash table; add(key, value) - if the key already exists, update value; exists(key); get(key); remove(key) | 0 |
| 24 | Trees | Trees - Intro | Intro to Trees (video) | - | 1 |
| 25 | Trees | Trees - Intro | Tree Traversal (video) | - | 1 |
| 26 | Trees | Trees - Intro | BFS(breadth-first search) and DFS(depth-first search) (video) | BFS notes; DFS notes | 1 |
| 27 | Trees | Trees - Intro | [Review] Breadth-first search in 4 minutes (video) | - | 1 |
| 28 | Trees | Trees - Intro | [Review] Depth-first search in 4 minutes (video) | - | 1 |
| 29 | Trees | Trees - Intro | [Review] Tree Traversal (playlist) in 11 minutes (video) | - | 1 |
| 30 | Trees | Binary search trees: BSTs | Binary Search Tree Review (video) | - | 1 |
| 31 | Trees | Binary search trees: BSTs | Introduction (video) | - | 1 |
| 32 | Trees | Binary search trees: BSTs | MIT (video) | - | 1 |
| 33 | Trees | Binary search trees: BSTs | C/C++ | Binary search tree - Implementation in C/C++ (video); BST implementation - memory allocation in stack and heap (video); Find min and max element in a binary search tree (video); Find the height of a binary tree (video); Binary tree traversal - breadth-first and depth-first strategies (video); Binary tree: Level Order Traversal (video); Binary tree traversal: Preorder, Inorder, Postorder (video); Check if a binary tree is a binary search tree or not (video); +2 more | 10 |
| 34 | Trees | Binary search trees: BSTs | Implement | insert // insert value into tree; get_node_count // get count of values stored; print_values // prints the values in the tree, from min to max; delete_tree; is_in_tree // returns true if a given value exists in the tree; get_height // returns the height in nodes (single node's height is 1); get_min // returns the minimum value stored in the tree; get_max // returns the maximum value stored in the tree; +3 more | 3 |
| 35 | Trees | Heap / Priority Queue / Binary Heap | Heap | - | 1 |
| 36 | Trees | Heap / Priority Queue / Binary Heap | Introduction (video) | - | 1 |
| 37 | Trees | Heap / Priority Queue / Binary Heap | Binary Trees (video) | - | 1 |
| 38 | Trees | Heap / Priority Queue / Binary Heap | Tree Height Remark (video) | - | 1 |
| 39 | Trees | Heap / Priority Queue / Binary Heap | Basic Operations (video) | - | 1 |
| 40 | Trees | Heap / Priority Queue / Binary Heap | Complete Binary Trees (video) | - | 1 |
| 41 | Trees | Heap / Priority Queue / Binary Heap | Pseudocode (video) | - | 1 |
| 42 | Trees | Heap / Priority Queue / Binary Heap | Heap Sort - jumps to start (video) | - | 1 |
| 43 | Trees | Heap / Priority Queue / Binary Heap | Heap Sort (video) | - | 1 |
| 44 | Trees | Heap / Priority Queue / Binary Heap | Building a heap (video) | - | 1 |
| 45 | Trees | Heap / Priority Queue / Binary Heap | MIT 6.006 Introduction to Algorithms: Binary Heaps | - | 1 |
| 46 | Trees | Heap / Priority Queue / Binary Heap | CS 61B Lecture 24: Priority Queues (video) | - | 1 |
| 47 | Trees | Heap / Priority Queue / Binary Heap | Linear Time BuildHeap (max-heap) | - | 1 |
| 48 | Trees | Heap / Priority Queue / Binary Heap | [Review] Heap (playlist) in 13 minutes (video) | - | 1 |
| 49 | Trees | Heap / Priority Queue / Binary Heap | Implement a max-heap | insert; sift_up - needed for insert; get_max - returns the max item, without removing it; get_size() - return number of elements stored; is_empty() - returns true if the heap contains no elements; extract_max - returns the max item, removing it; sift_down - needed for extract_max; remove(x) - removes item at index x; +2 more | 0 |
| 50 | Graphs | - | Notes | There are 4 basic ways to represent a graph in memory; Familiarize yourself with each representation and its pros & cons; BFS and DFS - know their computational complexity, their trade-offs,...; When asked a question, look for a graph-based solution first, then... | 0 |
| 51 | Graphs | - | MIT(videos) | Breadth-First Search; Depth-First Search | 2 |
| 52 | Graphs | - | Skiena Lectures - great intro | CSE373 2020 - Lecture 10 - Graph Data Structures (video); CSE373 2020 - Lecture 11 - Graph Traversal (video); CSE373 2020 - Lecture 12 - Depth First Search (video); CSE373 2020 - Lecture 13 - Minimum Spanning Trees (video); CSE373 2020 - Lecture 14 - Minimum Spanning Trees (con't) (video); CSE373 2020 - Lecture 15 - Graph Algorithms (con't 2) (video) | 6 |
| 53 | Graphs | - | Graphs (review and more) | 6.006 Single-Source Shortest Paths Problem (video); 6.006 Dijkstra (video); 6.006 Bellman-Ford (video); 6.006 Speeding Up Dijkstra (video); Aduni: Graph Algorithms I - Topological Sorting, Minimum Spanning...; Aduni: Graph Algorithms II - DFS, BFS, Kruskal's Algorithm, Union...; Aduni: Graph Algorithms III: Shortest Path - Lecture 8 (video); Aduni: Graph Alg. IV: Intro to geometric algorithms - Lecture 9 (video); +5 more | 13 |
| 54 | Graphs | - | Full Coursera Course | Algorithms on Graphs (video) | 1 |
| 55 | Graphs | - | I'll implement | DFS with adjacency list (recursive); DFS with adjacency list (iterative with stack); DFS with adjacency matrix (recursive); DFS with adjacency matrix (iterative with stack); BFS with adjacency list; BFS with adjacency matrix; single-source shortest path (Dijkstra); minimum spanning tree; +1 more | 0 |
| 56 | Even More Knowledge | Tries | Sedgewick - Tries (3 videos) | 1. R Way Tries; 2. Ternary Search Tries; 3. Character Based Operations | 4 |
| 57 | Even More Knowledge | Tries | Notes on Data Structures and Programming Techniques | - | 1 |
| 58 | Even More Knowledge | Tries | Short course videos | Introduction To Tries (video); Performance Of Tries (video); Implementing A Trie (video) | 3 |
| 59 | Even More Knowledge | Tries | The Trie: A Neglected Data Structure | - | 1 |
| 60 | Even More Knowledge | Tries | TopCoder - Using Tries | - | 1 |
| 61 | Even More Knowledge | Tries | Stanford Lecture (real-world use case) (video) | - | 1 |
| 62 | Even More Knowledge | Tries | MIT, Advanced Data Structures, Strings (can get pretty obscure about halfway through) (video) | - | 1 |
| 63 | Additional Learning | Bloom Filter | Given a Bloom filter with m bits and k hashing functions, both insertion and membership testing are O(k) | - | 0 |
| 64 | Additional Learning | Bloom Filter | Bloom Filters (video) | - | 1 |
| 65 | Additional Learning | Bloom Filter | Bloom Filters \| Mining of Massive Datasets \| Stanford University (video) | - | 1 |
| 66 | Additional Learning | Bloom Filter | Tutorial | - | 1 |
| 67 | Additional Learning | Bloom Filter | How To Write A Bloom Filter App | - | 1 |
| 68 | Additional Learning | HyperLogLog | How To Count A Billion Distinct Objects Using Only 1.5KB Of Memory | - | 1 |
| 69 | Additional Learning | Locality-Sensitive Hashing | Used to determine the similarity of documents | - | 0 |
| 70 | Additional Learning | Locality-Sensitive Hashing | The opposite of MD5 or SHA which are used to determine if 2 documents/strings are exactly the same | - | 0 |
| 71 | Additional Learning | Locality-Sensitive Hashing | Simhashing (hopefully) made simple | - | 1 |
| 72 | Additional Learning | van Emde Boas Trees | Divide & Conquer: van Emde Boas Trees (video) | - | 1 |
| 73 | Additional Learning | van Emde Boas Trees | MIT Lecture Notes | - | 1 |
| 74 | Additional Learning | Augmented Data Structures | CS 61B Lecture 39: Augmenting Data Structures | - | 1 |
| 75 | Additional Learning | Balanced search trees | Know at least one type of balanced binary tree (and know how it's implemented) | - | 0 |
| 76 | Additional Learning | Balanced search trees | "Among balanced search trees, AVL and 2/3 trees are now passé and red-black trees seem to be more popular. | - | 0 |
| 77 | Additional Learning | Balanced search trees | Of these, I chose to implement a splay tree. From what I've read, you won't implement a | Splay tree: insert, search, delete functions; Search and insertion functions, skipping delete | 0 |
| 78 | Additional Learning | Balanced search trees | I want to learn more about B-Tree since it's used so widely with very large data sets | - | 0 |
| 79 | Additional Learning | Balanced search trees | Self-balancing binary search tree | - | 1 |
| 80 | Additional Learning | Balanced search trees | **AVL trees** | In practice; MIT AVL Trees / AVL Sort (video); AVL Trees (video); AVL Tree Implementation (video); Split And Merge; [Review] AVL Trees (playlist) in 19 minutes (video) | 5 |
| 81 | Additional Learning | Balanced search trees | **Splay trees** | In practice; CS 61B: Splay Trees (video); MIT Lecture: Splay Trees | 2 |
| 82 | Additional Learning | Balanced search trees | **Red/black trees** | These are a translation of a 2-3 tree (see below).; In practice; Aduni - Algorithms - Lecture 4 (link jumps to the starting point)...; Aduni - Algorithms - Lecture 5 (video); Red-Black Tree; An Introduction To Binary Search And Red Black Tree; [Review] Red-Black Trees (playlist) in 30 minutes (video) | 5 |
| 83 | Additional Learning | Balanced search trees | **2-3 search trees** | In practice; You would use 2-3 trees very rarely because its implementation...; 23-Tree Intuition and Definition (video); Binary View of 23-Tree; 2-3 Trees (student recitation) (video) | 3 |
| 84 | Additional Learning | Balanced search trees | **2-3-4 Trees (aka 2-4 trees)** | In practice; CS 61B Lecture 26: Balanced Search Trees (video); Bottom Up 234-Trees (video); Top Down 234-Trees (video) | 3 |
| 85 | Additional Learning | Balanced search trees | **N-ary (K-ary, M-ary) trees** | note: the N or K is the branching factor (max branches); binary trees are a 2-ary tree, with branching factor = 2; 2-3 trees are 3-ary; K-Ary Tree | 1 |
| 86 | Additional Learning | Balanced search trees | **B-Trees** | Fun fact: it's a mystery, but the B could stand for Boeing,...; In Practice; B-Tree; B-Tree Datastructure; Introduction to B-Trees (video); B-Tree Definition and Insertion (video); B-Tree Deletion (video); MIT 6.851 - Memory Hierarchy Models (video); +1 more | 7 |
| 87 | Additional Learning | k-D Trees | Great for finding a number of points in a rectangle or higher-dimensional object | - | 0 |
| 88 | Additional Learning | k-D Trees | A good fit for k-nearest neighbors | - | 0 |
| 89 | Additional Learning | k-D Trees | kNN K-d tree algorithm (video) | - | 1 |
| 90 | Additional Learning | Skip lists | "These are somewhat of a cult data structure" - Skiena | - | 0 |
| 91 | Additional Learning | Skip lists | Randomization: Skip Lists (video) | - | 1 |
| 92 | Additional Learning | Skip lists | For animations and a little more detail | - | 1 |
| 93 | Additional Learning | Disjoint Sets & Union Find | UCB 61B - Disjoint Sets; Sorting & selection (video) | - | 1 |
| 94 | Additional Learning | Disjoint Sets & Union Find | Sedgewick Algorithms - Union-Find (6 videos) | - | 1 |
| 95 | Additional Learning | Treap | Combination of a binary search tree and a heap | - | 0 |
| 96 | Additional Learning | Treap | Treap | - | 1 |
| 97 | Additional Learning | Treap | Data Structures: Treaps explained (video) | - | 1 |
| 98 | Additional Learning | Treap | Applications in set operations | - | 1 |
| 99 | Additional Detail on Some Subjects | Union-Find | Overview | - | 1 |
| 100 | Additional Detail on Some Subjects | Union-Find | Naive Implementation | - | 1 |
| 101 | Additional Detail on Some Subjects | Union-Find | Trees | - | 1 |
| 102 | Additional Detail on Some Subjects | Union-Find | Union By Rank | - | 1 |
| 103 | Additional Detail on Some Subjects | Union-Find | Path Compression | - | 1 |
| 104 | Additional Detail on Some Subjects | Union-Find | Analysis Options | - | 1 |

**Coverage:** 104 topics, 217 sub-topics, 154 linked resources upstream.

**Read the topic column with care.** 60 of the 104 rows (58%) are the title of a linked video or article, because that is what upstream lists where a concept name would go ("HTTP (video)", "Khan Academy"). They are kept verbatim rather than reworded into concepts, which would be inventing curriculum. Name the real concept when mapping these to floors, and do not read the row count as a count of distinct concepts.

## Still to do

- Topics above are **not yet mapped to floors**. Grouping and ordering them into floors is an authoring decision.
- No lesson text, practice or exam content exists for this dungeon, and this source cannot supply any: it is an index of links. Teaching text must be written, or imported from a source whose licence allows embedding.
<!-- GENERATED:END -->
