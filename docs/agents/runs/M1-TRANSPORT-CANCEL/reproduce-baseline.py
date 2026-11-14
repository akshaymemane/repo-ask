"""Run only the two socket cancellation regressions against the assigned Git base.

From this worktree:
  PYTHONPATH=.:tests <project-python> docs/agents/runs/M1-TRANSPORT-CANCEL/reproduce-baseline.py

Exit zero means both reproduce the expected blocked-caller failure. No network
outside the local fixture is used; the worktree source is never modified.
"""
import subprocess
import sys
import types
import unittest

import test_provider_transport_cancel as tests

source = subprocess.check_output(
    ['git', 'show', '797009ba899740e477db3b88eacdb90fb80cb3e7:repoask/providers/transport.py'],
    text=True,
)
baseline = types.ModuleType('baseline_transport')
sys.modules[baseline.__name__] = baseline
exec(compile(source, '<base-797009b-transport>', 'exec'), baseline.__dict__)
tests.UrllibTransport = baseline.UrllibTransport
names = [
    'test_cancel_while_nonstreaming_response_headers_withheld',
    'test_cancel_while_response_body_blocked',
]
result = unittest.TextTestRunner(verbosity=2).run(
    unittest.TestSuite(tests.TransportNetworkTests(name) for name in names)
)
if len(result.failures) != 2 or result.errors:
    raise SystemExit('expected exactly two cancellation regressions against baseline')
for _, failure in result.failures:
    if 'cancel blocked on provider response' not in failure:
        raise SystemExit('baseline failed for a reason other than blocked cancellation')
print('Confirmed: both cancellation regressions fail against unchanged base transport.')
