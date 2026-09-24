import { defineFixture } from "./define";

export default defineFixture({
  title: "O(1) LRU Cache",
  language: "cpp",
  difficulty: "expert",
  category: "data-structures",
  archetype: "caching",
  summary:
    "Build a generic least-recently-used cache with O(1) average get/put, capacity-based eviction and an eviction callback.",
  problemStatement: `A rendering service caches expensive glyph rasterizations. Memory is bounded, so when the cache is full the **least recently used** entry must be evicted.

Implement the class template \`LruCache<K, V>\` from the starter code. Both \`get\` and \`put\` must run in **O(1) average time** — a linear scan to find the oldest entry is not acceptable.`,
  realWorldContext:
    "LRU caches back CPU caches, database buffer pools and CDNs; the list + hash map design is a classic systems interview question with real production use.",
  requirements: [
    "`explicit LruCache(std::size_t capacity)` creates an empty cache. A capacity of 0 stores nothing.",
    "`std::optional<V> get(const K& key)` returns the value and marks the key as most recently used, or `std::nullopt` if absent.",
    "`void put(const K& key, V value)` inserts or updates the value and marks the key as most recently used. Updating an existing key never evicts.",
    "When inserting a new key into a full cache, evict the least recently used entry first.",
    "`void on_evict(std::function<void(const K&, const V&)> callback)` registers a callback invoked for each evicted entry.",
    "`std::size_t size() const` returns the number of stored entries; `bool contains(const K&) const` checks presence **without** affecting recency.",
  ],
  constraints: [
    "O(1) average `get` and `put`.",
    "Compiled with `-fno-exceptions`: do not use `throw`/`try`.",
    "Must work for non-default-constructible value types.",
  ],
  starterCode: `#include <cstddef>
#include <functional>
#include <optional>

template <class K, class V>
class LruCache {
public:
    explicit LruCache(std::size_t capacity) : capacity_(capacity) {}

    std::optional<V> get(const K& key) {
        (void)key;
        return std::nullopt;
    }

    void put(const K& key, V value) {
        (void)key;
        (void)value;
    }

    bool contains(const K& key) const {
        (void)key;
        return false;
    }

    std::size_t size() const { return 0; }

    void on_evict(std::function<void(const K&, const V&)> callback) { evict_ = std::move(callback); }

private:
    std::size_t capacity_;
    std::function<void(const K&, const V&)> evict_;
};
`,
  referenceSolution: `#include <cstddef>
#include <functional>
#include <list>
#include <optional>
#include <unordered_map>
#include <utility>

template <class K, class V>
class LruCache {
public:
    explicit LruCache(std::size_t capacity) : capacity_(capacity) {}

    std::optional<V> get(const K& key) {
        auto it = index_.find(key);
        if (it == index_.end()) return std::nullopt;
        // Move the node to the front without reallocating it.
        order_.splice(order_.begin(), order_, it->second);
        return it->second->second;
    }

    void put(const K& key, V value) {
        if (capacity_ == 0) return;
        auto it = index_.find(key);
        if (it != index_.end()) {
            it->second->second = std::move(value);
            order_.splice(order_.begin(), order_, it->second);
            return;
        }
        if (order_.size() == capacity_) {
            auto& victim = order_.back();
            if (evict_) evict_(victim.first, victim.second);
            index_.erase(victim.first);
            order_.pop_back();
        }
        order_.emplace_front(key, std::move(value));
        index_.emplace(key, order_.begin());
    }

    bool contains(const K& key) const { return index_.count(key) != 0; }

    std::size_t size() const { return order_.size(); }

    void on_evict(std::function<void(const K&, const V&)> callback) { evict_ = std::move(callback); }

private:
    using Node = std::pair<K, V>;
    std::size_t capacity_;
    std::list<Node> order_;  // front = most recently used
    std::unordered_map<K, typename std::list<Node>::iterator> index_;
    std::function<void(const K&, const V&)> evict_;
};
`,
  explanation:
    "A doubly linked list keeps entries in recency order (front = newest) and an `unordered_map` maps keys to list iterators. `std::list::splice` moves a node to the front in O(1) without invalidating iterators, so both lookup and reordering are constant time. Eviction pops the back after invoking the callback. Values are only ever moved or copied into list nodes, so no default constructor is required.",
  complexity: { time: "O(1) average get/put", space: "O(capacity)" },
  tests: {
    prelude: `#include <string>
#include <vector>

struct NoDefault {
    explicit NoDefault(int v) : value(v) {}
    int value;
};`,
    cases: [
      {
        id: "get-put",
        name: "stores and retrieves values",
        hidden: false,
        code: `LruCache<std::string, int> cache(2);\ncache.put("a", 1);\nCHECK(cache.get("a").has_value());\nCHECK_EQ(*cache.get("a"), 1);\nCHECK(!cache.get("missing").has_value());`,
      },
      {
        id: "evicts-lru",
        name: "evicts the least recently used entry",
        hidden: false,
        code: `LruCache<int, int> cache(2);\ncache.put(1, 10);\ncache.put(2, 20);\ncache.get(1);\ncache.put(3, 30);\nCHECK(cache.contains(1));\nCHECK(!cache.contains(2));\nCHECK(cache.contains(3));\nCHECK_EQ(cache.size(), 2u);`,
      },
      {
        id: "update-no-evict",
        name: "updating an existing key does not evict",
        hidden: false,
        code: `LruCache<int, int> cache(2);\ncache.put(1, 10);\ncache.put(2, 20);\ncache.put(1, 11);\nCHECK_EQ(cache.size(), 2u);\nCHECK_EQ(*cache.get(1), 11);\nCHECK(cache.contains(2));`,
      },
      {
        id: "evict-callback",
        name: "invokes the eviction callback",
        hidden: false,
        code: `LruCache<int, std::string> cache(1);\nstd::vector<int> evicted;\ncache.on_evict([&](const int& k, const std::string&) { evicted.push_back(k); });\ncache.put(1, "one");\ncache.put(2, "two");\ncache.put(3, "three");\nCHECK_EQ(evicted.size(), 2u);\nCHECK_EQ(evicted[0], 1);\nCHECK_EQ(evicted[1], 2);`,
      },
      {
        id: "contains-no-touch",
        name: "contains() does not affect recency",
        hidden: true,
        code: `LruCache<int, int> cache(2);\ncache.put(1, 1);\ncache.put(2, 2);\nCHECK(cache.contains(1));\ncache.put(3, 3);\nCHECK(!cache.contains(1));`,
      },
      {
        id: "zero-capacity",
        name: "stores nothing with capacity 0",
        hidden: true,
        code: `LruCache<int, int> cache(0);\ncache.put(1, 1);\nCHECK_EQ(cache.size(), 0u);\nCHECK(!cache.get(1).has_value());`,
      },
      {
        id: "no-default-ctor",
        name: "supports non-default-constructible values",
        hidden: true,
        code: `LruCache<int, NoDefault> cache(2);\ncache.put(1, NoDefault(5));\nauto hit = cache.get(1);\nCHECK(hit.has_value());\nCHECK_EQ(hit->value, 5);`,
      },
      {
        id: "constant-time",
        name: "handles 200k operations quickly",
        hidden: true,
        code: `LruCache<int, int> cache(1000);\nfor (int i = 0; i < 200000; i++) {\n    cache.put(i, i);\n    if (i % 3 == 0) cache.get(i / 2);\n}\nCHECK_EQ(cache.size(), 1000u);\nCHECK(cache.contains(199999));`,
      },
    ],
  },
  expectedConcepts: [
    "hash maps",
    "doubly linked lists",
    "iterator stability",
    "std::list::splice",
    "templates",
  ],
  estimatedTimeMinutes: 55,
});
