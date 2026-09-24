# Coding Challenge Lab — Python test harness (runs inside Pyodide).
# Each test runs in a fresh namespace with a fresh import of `solution`, and
# reports one protocol line on stdout. Kept free of third-party imports.
import ast
import json
import linecache
import sys
import textwrap
import time
import traceback

WORK_DIR = "/work"
SOLUTION = WORK_DIR + "/solution.py"


def _report(nonce, record):
    sys.stdout.write("\x1eCCL:" + nonce + ":" + json.dumps(record) + "\n")
    sys.stdout.flush()


def _user_frames(tb):
    frames = [f for f in traceback.extract_tb(tb) if f.filename == SOLUTION or f.filename.startswith("<test ")]
    return traceback.format_list(frames[-4:])


def format_exception(exc):
    lines = _user_frames(exc.__traceback__)
    head = "".join(traceback.format_exception_only(type(exc), exc)).strip()
    return ("".join(lines) + head).strip()


_SAFE_NODES = (ast.Name, ast.Constant, ast.Attribute, ast.Subscript, ast.Tuple, ast.List, ast.UnaryOp, ast.Load, ast.Index if hasattr(ast, "Index") else ast.Load)


def _is_safe(node):
    # Only re-evaluate side-effect-free expressions (no calls) to show values.
    return all(isinstance(n, (ast.expr_context, ast.operator, ast.unaryop, ast.slice)) or isinstance(n, _SAFE_NODES) for n in ast.walk(node))


def describe_assertion(exc):
    if str(exc):
        return "AssertionError: " + str(exc)
    tb = exc.__traceback__
    while tb.tb_next is not None:
        tb = tb.tb_next
    frame = tb.tb_frame
    source = linecache.getline(frame.f_code.co_filename, tb.tb_lineno).strip()
    message = "Assertion failed: " + (source or "assert")
    try:
        node = ast.parse(source).body[0]
        if isinstance(node, ast.Assert) and isinstance(node.test, ast.Compare) and len(node.test.ops) == 1:
            left, right = node.test.left, node.test.comparators[0]
            if _is_safe(left) and _is_safe(right):
                scope = dict(frame.f_globals)
                scope.update(frame.f_locals)
                lv = eval(compile(ast.Expression(left), "<assert>", "eval"), scope)
                rv = eval(compile(ast.Expression(right), "<assert>", "eval"), scope)
                message += "\n  left:  " + repr(lv)[:500] + "\n  right: " + repr(rv)[:500]
    except Exception:
        pass
    return message


def run_program():
    import runpy

    sys.modules.pop("solution", None)
    runpy.run_path(SOLUTION, run_name="__main__")


def run_tests(nonce, spec_json):
    spec = json.loads(spec_json)
    prelude = spec["prelude"]
    if WORK_DIR not in sys.path:
        sys.path.insert(0, WORK_DIR)
    for case in spec["cases"]:
        case_id = case["id"]
        sys.modules.pop("solution", None)
        body = case["code"] if case["code"].strip() else "pass"
        filename = "<test " + case_id + ">"
        source = prelude + "\n\ndef __ccl_test__():\n" + textwrap.indent(body, "    ") + "\n"
        linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)
        started = time.perf_counter()
        try:
            namespace = {"__name__": "__ccl_test__"}
            exec(compile(source, filename, "exec"), namespace)
            namespace["__ccl_test__"]()
            _report(nonce, {"id": case_id, "status": "pass", "durationMs": (time.perf_counter() - started) * 1000})
        except AssertionError as exc:
            _report(nonce, {"id": case_id, "status": "fail", "message": describe_assertion(exc)[:2000], "durationMs": (time.perf_counter() - started) * 1000})
        except SyntaxError as exc:
            if exc.filename == filename:
                raise RuntimeError("The test '" + case_id + "' has invalid syntax: " + str(exc))
            _report(nonce, {"id": case_id, "status": "error", "message": format_exception(exc)[:2000]})
        except BaseException as exc:  # includes SystemExit from user code
            _report(nonce, {"id": case_id, "status": "error", "message": format_exception(exc)[:2000], "durationMs": (time.perf_counter() - started) * 1000})
