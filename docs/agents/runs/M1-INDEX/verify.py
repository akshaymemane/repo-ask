"""Repeat regression evidence; HTTP exclusion is explicit, never a passing full suite."""
from pathlib import Path
import sys
import unittest

root = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(root))
suite = unittest.defaultTestLoader.discover(str(root / 'tests'))

def flatten(group):
    for item in group:
        if isinstance(item, unittest.TestSuite):
            yield from flatten(item)
        else:
            yield item

if '--without-http' in sys.argv:
    all_tests = list(flatten(suite))
    omitted = [test.id() for test in all_tests if test.id().startswith('test_http_foundation.')]
    print('Explicitly omitted socket-dependent HTTP tests:', len(omitted), flush=True)
    suite = unittest.TestSuite(test for test in all_tests if test.id() not in omitted)

result = unittest.TextTestRunner(verbosity=1).run(suite)
raise SystemExit(not result.wasSuccessful())
