/* Coding Challenge Lab — C/C++ test harness.
 * Each test is a function; a CHECK failure records a message and returns.
 * The generated main() runs one test per fresh WebAssembly instance and
 * reports a single protocol line on stdout. */
#ifndef CCL_TEST_H
#define CCL_TEST_H

#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int ccl_failed = 0;
static char ccl_message[2048];

static void ccl_set_failure(const char *format, ...) {
  va_list args;
  va_start(args, format);
  vsnprintf(ccl_message, sizeof ccl_message, format, args);
  va_end(args);
  ccl_failed = 1;
}

#define CCL_FAIL(...)            \
  do {                           \
    ccl_set_failure(__VA_ARGS__); \
    return;                      \
  } while (0)

#define CHECK(cond)                                                     \
  do {                                                                  \
    if (!(cond)) CCL_FAIL("line %d: CHECK(%s) failed", __LINE__, #cond); \
  } while (0)

#define CHECK_EQ_INT(a, b)                                                                                    \
  do {                                                                                                        \
    long long ccl_a = (long long)(a), ccl_b = (long long)(b);                                                 \
    if (ccl_a != ccl_b) CCL_FAIL("line %d: CHECK_EQ_INT(%s, %s): %lld != %lld", __LINE__, #a, #b, ccl_a, ccl_b); \
  } while (0)

#define CHECK_EQ_STR(a, b)                                                                            \
  do {                                                                                                \
    const char *ccl_a = (a), *ccl_b = (b);                                                            \
    if (!ccl_a || !ccl_b || strcmp(ccl_a, ccl_b) != 0)                                                \
      CCL_FAIL("line %d: CHECK_EQ_STR(%s, %s): \"%s\" != \"%s\"", __LINE__, #a, #b, ccl_a ? ccl_a : "(null)", \
               ccl_b ? ccl_b : "(null)");                                                             \
  } while (0)

#define CHECK_NEAR(a, b, eps)                                                                                  \
  do {                                                                                                         \
    double ccl_a = (double)(a), ccl_b = (double)(b);                                                           \
    if (fabs(ccl_a - ccl_b) > (eps)) CCL_FAIL("line %d: CHECK_NEAR(%s, %s): %g vs %g", __LINE__, #a, #b, ccl_a, ccl_b); \
  } while (0)

#ifdef __cplusplus
#include <sstream>
#include <string>
namespace ccl {
template <class T>
std::string show(const T &value) {
  if constexpr (requires(std::ostream &out) { out << value; }) {
    std::ostringstream out;
    out << value;
    return out.str();
  } else {
    return "<value>";
  }
}
}  // namespace ccl

/* Generic equality for any ==-comparable types; prints values when streamable. */
#define CHECK_EQ(a, b)                                                                                  \
  do {                                                                                                  \
    const auto &ccl_a = (a);                                                                            \
    const auto &ccl_b = (b);                                                                            \
    if (!(ccl_a == ccl_b))                                                                              \
      CCL_FAIL("line %d: CHECK_EQ(%s, %s): %s != %s", __LINE__, #a, #b, ccl::show(ccl_a).c_str(),       \
               ccl::show(ccl_b).c_str());                                                               \
  } while (0)
#endif

static void ccl_json_string(const char *text) {
  putchar('"');
  for (const unsigned char *p = (const unsigned char *)text; *p; ++p) {
    if (*p == '"' || *p == '\\') printf("\\%c", *p);
    else if (*p == '\n') fputs("\\n", stdout);
    else if (*p < 0x20) printf("\\u%04x", *p);
    else putchar(*p);
  }
  putchar('"');
}

static void ccl_report(const char *nonce, const char *id) {
  fflush(stdout);
  printf("\n\x1e" "CCL:%s:{\"id\":", nonce);
  ccl_json_string(id);
  printf(",\"status\":\"%s\"", ccl_failed ? "fail" : "pass");
  if (ccl_failed) {
    fputs(",\"message\":", stdout);
    ccl_json_string(ccl_message);
  }
  fputs("}\n", stdout);
  fflush(stdout);
}

#endif
