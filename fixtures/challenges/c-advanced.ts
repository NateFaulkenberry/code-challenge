import { defineFixture } from "./define";

export default defineFixture({
  title: "Audio Ring Buffer",
  language: "c",
  difficulty: "advanced",
  category: "systems",
  archetype: "data-structure",
  summary:
    "Implement a fixed-capacity ring buffer of audio samples with bulk read/write and explicit overflow behaviour.",
  problemStatement: `An audio pipeline moves 16-bit samples from a decoder (producer) to an output device (consumer). They run at different paces, so samples are staged in a **ring buffer** with a capacity fixed at creation.

Implement the API in the starter code. All functions operate on caller-owned memory: \`rb_init\` receives the storage array, so the buffer never allocates.`,
  realWorldContext:
    "Lock-free ring buffers sit between audio callbacks and decoders in every real-time audio stack; getting wrap-around and full/empty detection right is the whole game.",
  requirements: [
    "`rb_init(rb, storage, capacity)` prepares an empty buffer over `storage[capacity]`.",
    "`rb_write(rb, samples, count)` appends up to `count` samples and returns how many were written. It never overwrites unread data: when the buffer fills, the remaining samples are dropped.",
    "`rb_read(rb, out, count)` removes up to `count` samples in FIFO order into `out` and returns how many were read.",
    "`rb_size` and `rb_space` return the number of readable samples and free slots; `rb_size + rb_space == capacity` always holds.",
    'The full capacity must be usable (no "one slot always empty" trick).',
    "Reads and writes must work across the wrap-around point, including bulk operations that span it.",
  ],
  constraints: [
    "No dynamic allocation.",
    "O(count) per read/write; no shifting of stored samples.",
  ],
  starterCode: `#include <stddef.h>
#include <stdint.h>

typedef struct {
    int16_t *data;
    size_t capacity;
    /* TODO: add the fields you need */
} RingBuffer;

void rb_init(RingBuffer *rb, int16_t *storage, size_t capacity) {
    rb->data = storage;
    rb->capacity = capacity;
}

size_t rb_write(RingBuffer *rb, const int16_t *samples, size_t count) {
    (void)rb; (void)samples; (void)count;
    return 0;
}

size_t rb_read(RingBuffer *rb, int16_t *out, size_t count) {
    (void)rb; (void)out; (void)count;
    return 0;
}

size_t rb_size(const RingBuffer *rb) {
    (void)rb;
    return 0;
}

size_t rb_space(const RingBuffer *rb) {
    return rb->capacity - rb_size(rb);
}
`,
  referenceSolution: `#include <stddef.h>
#include <stdint.h>

typedef struct {
    int16_t *data;
    size_t capacity;
    size_t head;  /* next index to read */
    size_t count; /* readable samples */
} RingBuffer;

void rb_init(RingBuffer *rb, int16_t *storage, size_t capacity) {
    rb->data = storage;
    rb->capacity = capacity;
    rb->head = 0;
    rb->count = 0;
}

size_t rb_size(const RingBuffer *rb) {
    return rb->count;
}

size_t rb_space(const RingBuffer *rb) {
    return rb->capacity - rb->count;
}

size_t rb_write(RingBuffer *rb, const int16_t *samples, size_t count) {
    size_t n = count < rb_space(rb) ? count : rb_space(rb);
    size_t tail = (rb->head + rb->count) % (rb->capacity ? rb->capacity : 1);
    for (size_t i = 0; i < n; i++) {
        rb->data[tail] = samples[i];
        tail = (tail + 1 == rb->capacity) ? 0 : tail + 1;
    }
    rb->count += n;
    return n;
}

size_t rb_read(RingBuffer *rb, int16_t *out, size_t count) {
    size_t n = count < rb->count ? count : rb->count;
    for (size_t i = 0; i < n; i++) {
        out[i] = rb->data[rb->head];
        rb->head = (rb->head + 1 == rb->capacity) ? 0 : rb->head + 1;
    }
    rb->count -= n;
    return n;
}
`,
  explanation:
    "Tracking `head` plus an explicit `count` (rather than head and tail indices alone) removes the full-versus-empty ambiguity, so every slot is usable. The write position is derived as `(head + count) % capacity`, and both loops wrap their index with a compare instead of a modulo in the hot path.",
  complexity: { time: "O(count) per operation", space: "O(1) beyond caller storage" },
  tests: {
    prelude: `static RingBuffer make(int16_t *storage, size_t capacity) {
    RingBuffer rb;
    rb_init(&rb, storage, capacity);
    return rb;
}`,
    cases: [
      {
        id: "starts-empty",
        name: "starts empty with full space",
        hidden: false,
        code: `int16_t s[8];\nRingBuffer rb = make(s, 8);\nCHECK_EQ_INT(rb_size(&rb), 0);\nCHECK_EQ_INT(rb_space(&rb), 8);`,
      },
      {
        id: "fifo-order",
        name: "reads samples back in FIFO order",
        hidden: false,
        code: `int16_t s[8], out[3];\nRingBuffer rb = make(s, 8);\nint16_t in[3] = {10, 20, 30};\nCHECK_EQ_INT(rb_write(&rb, in, 3), 3);\nCHECK_EQ_INT(rb_read(&rb, out, 3), 3);\nCHECK_EQ_INT(out[0], 10);\nCHECK_EQ_INT(out[2], 30);\nCHECK_EQ_INT(rb_size(&rb), 0);`,
      },
      {
        id: "drops-when-full",
        name: "drops samples instead of overwriting when full",
        hidden: false,
        code: `int16_t s[4], out[4];\nRingBuffer rb = make(s, 4);\nint16_t in[6] = {1, 2, 3, 4, 5, 6};\nCHECK_EQ_INT(rb_write(&rb, in, 6), 4);\nCHECK_EQ_INT(rb_space(&rb), 0);\nrb_read(&rb, out, 4);\nCHECK_EQ_INT(out[3], 4);`,
      },
      {
        id: "partial-read",
        name: "reads at most what is available",
        hidden: false,
        code: `int16_t s[4], out[4];\nRingBuffer rb = make(s, 4);\nint16_t in[2] = {7, 8};\nrb_write(&rb, in, 2);\nCHECK_EQ_INT(rb_read(&rb, out, 4), 2);\nCHECK_EQ_INT(rb_read(&rb, out, 4), 0);`,
      },
      {
        id: "wraps-around",
        name: "handles bulk operations across the wrap point",
        hidden: true,
        code: `int16_t s[5], out[5];\nRingBuffer rb = make(s, 5);\nint16_t a[4] = {1, 2, 3, 4}, b[4] = {5, 6, 7, 8};\nrb_write(&rb, a, 4);\nrb_read(&rb, out, 3);\nCHECK_EQ_INT(rb_write(&rb, b, 4), 4);\nCHECK_EQ_INT(rb_size(&rb), 5);\nCHECK_EQ_INT(rb_read(&rb, out, 5), 5);\nint16_t expected[5] = {4, 5, 6, 7, 8};\nfor (int i = 0; i < 5; i++) CHECK_EQ_INT(out[i], expected[i]);`,
      },
      {
        id: "invariant",
        name: "keeps size + space == capacity through many operations",
        hidden: true,
        code: `int16_t s[7], buf[5];\nRingBuffer rb = make(s, 7);\nfor (int i = 0; i < 200; i++) {\n    int16_t in[5] = {1, 2, 3, 4, 5};\n    rb_write(&rb, in, (size_t)(i % 5));\n    rb_read(&rb, buf, (size_t)((i * 3) % 5));\n    CHECK_EQ_INT(rb_size(&rb) + rb_space(&rb), 7);\n}`,
      },
      {
        id: "sequence-integrity",
        name: "preserves a long sequence exactly",
        hidden: true,
        code: `int16_t s[16], out[1];\nRingBuffer rb = make(s, 16);\nint16_t next_in = 0, next_out = 0;\nfor (int round = 0; round < 1000; round++) {\n    int16_t chunk[3] = {next_in, (int16_t)(next_in + 1), (int16_t)(next_in + 2)};\n    next_in = (int16_t)(next_in + (int16_t)rb_write(&rb, chunk, 3));\n    while (rb_size(&rb) > 8) { rb_read(&rb, out, 1); CHECK_EQ_INT(out[0], next_out); next_out++; }\n}`,
      },
    ],
  },
  expectedConcepts: [
    "ring buffers",
    "modular indexing",
    "full vs empty detection",
    "caller-owned memory",
  ],
  estimatedTimeMinutes: 40,
});
