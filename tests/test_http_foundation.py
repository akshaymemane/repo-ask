"""Exercise actual loopback HTTP dispatch and durable metadata across restarts."""
import http.client
from pathlib import Path
import json
from tempfile import TemporaryDirectory
from threading import Thread
from http.server import ThreadingHTTPServer
import unittest

from repoask.__main__ import RequestHandler, ROOT
from repoask.index import CodeIndex, load_demos
from repoask.platform import Platform


class FoundationHTTPTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.start(None)
        self.addCleanup(self.stop)

    def start(self, data_dir):
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), RequestHandler)
        self.server.index = CodeIndex(load_demos(ROOT / 'examples'))
        self.server.model = None
        self.server.platform = Platform.open(data_dir)
        self.thread = Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.01})
        self.thread.start()

    def stop(self):
        if getattr(self, 'server', None) is None:
            return
        self.server.shutdown()
        self.thread.join(3)
        self.server.server_close()
        self.server.platform.close()
        self.server.index.db.close()
        self.server = None

    def request(self, path, *, method='GET', body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        try:
            conn.request(method, path, body=body, headers=headers or {})
            response = conn.getresponse()
            data = json.loads(response.read())
            return response.status, data, dict(response.getheaders())
        finally:
            conn.close()

    def test_summary_health_and_legacy_routes_are_real(self):
        status, summary, headers = self.request('/api/workspace')
        self.assertEqual(status, 200)
        self.assertEqual(summary['mode'], 'demo')
        self.assertEqual(summary['catalog']['repository_count'], 4)
        self.assertFalse(summary['storage']['persistent'])
        self.assertEqual(summary['secrets']['available'], False)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        status, health, _ = self.request('/api/health')
        self.assertEqual(status, 200)
        self.assertEqual(health['components']['jobs']['workers_running'], 0)
        self.assertFalse(health['components']['model']['probed'])
        status, repositories, _ = self.request('/api/repos')
        self.assertEqual(status, 200)
        self.assertEqual(set(repositories), {'repos', 'model'})
        status, answer, _ = self.request('/api/ask', method='POST', body=json.dumps({
            'question': 'Trace checkout from the storefront through the orders API, database, and confirmation email.',
            'repos': [r['name'] for r in repositories['repos']],
        }), headers={'Content-Type': 'application/json'})
        self.assertEqual(status, 200)
        self.assertEqual({s['repo'] for s in answer['sources']}, {r['name'] for r in repositories['repos']})

    def test_status_routes_preserve_host_and_query_boundaries(self):
        for path in ['/api/workspace', '/api/health']:
            self.assertEqual(self.request(path, headers={'Host': 'attacker.invalid'})[0], 403)
            status, data, _ = self.request(path + '?unexpected=1')
            self.assertEqual(status, 400)
            self.assertEqual(data['code'], 'bad_request')
        status, data, _ = self.request('/api/no-such-route')
        self.assertEqual((status, set(data)), (404, {'error'}))
        status, _, _ = self.request('/api/ask', method='POST', body='{}', headers={
            'Origin': 'https://attacker.invalid', 'Content-Type': 'application/json'})
        self.assertEqual(status, 403)

    def test_durable_job_survives_server_restart(self):
        self.stop()
        directory = Path(self.directory.name)
        self.start(directory)
        job = self.server.platform.jobs.enqueue('test.restart', {'cursor': 7})
        self.stop()
        self.start(directory)
        self.assertEqual(self.server.platform.jobs.get(job.id).payload, {'cursor': 7})
        status, health, _ = self.request('/api/health')
        self.assertEqual(status, 200)
        self.assertEqual(health['components']['jobs']['counts']['queued'], 1)
        self.assertTrue(health['components']['storage']['persistent'])
        self.assertNotIn(self.directory.name, json.dumps(health))
        self.assertNotIn('cursor', json.dumps(health))


if __name__ == '__main__':
    unittest.main()
