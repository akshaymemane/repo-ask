"""Run the Docker-gated runner/broker tests (root-sanctioned owned probe wrapper).

Usage: python3 docs/agents/runs/M2-RUNNER-SPIKE/run_docker_tests.py [IMAGE]
Equivalent to: OPENDEVIN_DOCKER_TESTS=1 OPENDEVIN_TEST_IMAGE=IMAGE python3 -m unittest -v \
  tests.test_execution_runner.RealDockerIsolationTest tests.test_execution_broker.BrokerOverRealDockerTest
"""
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
sys.path.insert(0, ROOT)
os.environ['OPENDEVIN_DOCKER_TESTS'] = '1'
if len(sys.argv) > 1:
    os.environ['OPENDEVIN_TEST_IMAGE'] = sys.argv[1]

suite = unittest.defaultTestLoader.loadTestsFromNames([
    'tests.test_execution_runner.RealDockerIsolationTest',
    'tests.test_execution_broker.BrokerOverRealDockerTest',
])
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
