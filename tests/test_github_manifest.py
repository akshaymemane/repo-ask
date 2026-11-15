"""GitHub App Manifest setup: pinned manifest, single-use state, key stored, secrets dropped."""
import io
import json
import logging
import unittest
from tempfile import TemporaryDirectory
from urllib.parse import parse_qs, urlsplit
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from repoask.api import FeatureAPI
from repoask.platform import Platform
from repoask.platform.secrets import SecretService, BackendStatus
from repoask.github import GitHubService, GitHubError, Response


class TestVault:
    name = 'test-only'
    def __init__(self): self.values = {}
    def status(self): return BackendStatus(self.name, True, None)
    def put(self, key, value): self.values[key] = value
    def get(self, key): return self.values[key]
    def delete(self, key): self.values.pop(key, None)


class FakeGitHub:
    def __init__(self, pem):
        self.pem, self.requests, self.conversion_status = pem, [], 201

    def __call__(self, request):
        self.requests.append(request)
        if request.path == '/app':
            return Response(200, {}, {'id': 42, 'slug': 'opendevin-a1b2c3'})
        if request.path == '/app-manifests/abc/conversions':
            if self.conversion_status != 201:
                return Response(self.conversion_status, {}, {})
            return Response(201, {}, {'id': 42, 'slug': 'opendevin-a1b2c3', 'pem': self.pem,
                                      'client_id': 'Iv1.x', 'client_secret': 'CLIENT-SECRET-VALUE',
                                      'webhook_secret': 'WEBHOOK-SECRET-VALUE'})
        raise AssertionError('unexpected ' + request.path)


class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                    serialization.NoEncryption()).decode()

    def setUp(self):
        self.temp = TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.platform = Platform.open(self.temp.name); self.addCleanup(self.platform.close)
        self.now = 1700000000000
        self.vault = TestVault()
        self.secrets = SecretService(self.platform.store, self.vault, clock=lambda: self.now)
        self.remote = FakeGitHub(self.pem)
        self.service = GitHubService(self.platform.store, self.platform.jobs, self.secrets,
                                     transport=self.remote, clock=lambda: self.now)

    def begin(self, **kwargs):
        return self.service.begin_manifest(public_base_url='http://127.0.0.1:8765', **kwargs)

    def test_begin_manifest_pins_urls_and_read_only_permissions(self):
        out = self.begin()
        m = out['manifest']
        self.assertEqual(out['action'], 'https://github.com/settings/apps/new')
        self.assertEqual(out['expires_at'], self.now + 600000)
        self.assertEqual(m['url'], 'http://127.0.0.1:8765/api/github/manifest/callback')
        self.assertEqual(m['redirect_url'], 'http://127.0.0.1:8765/api/github/manifest/callback')
        self.assertEqual(m['setup_url'], 'http://127.0.0.1:8765/api/github/callback')
        # GitHub rejects loopback hook URLs (live test 2026-11-15); OpenDevin polls, so no webhook at all.
        self.assertNotIn('hook_attributes', m)
        self.assertNotIn('127.0.0.1', m['url'].replace('http://127.0.0.1:8765/api/github/manifest/callback', ''))
        self.assertEqual(m['default_permissions'], {'contents': 'read', 'metadata': 'read'})
        self.assertEqual(m['default_events'], [])
        self.assertFalse(m['public'])
        self.assertFalse(m['request_oauth_on_install'])
        self.assertFalse(m['setup_on_update'])
        self.assertRegex(m['name'], r'^opendevin-[0-9a-f]{6}$')

    def test_begin_manifest_for_organization(self):
        out = self.begin(organization='acme-co')
        self.assertEqual(out['action'], 'https://github.com/organizations/acme-co/settings/apps/new')
        for bad in ('acme/../x', '', 'a' * 40, 'acme co'):
            with self.assertRaises(GitHubError):
                self.begin(organization=bad)

    def test_begin_manifest_rejects_non_loopback_base(self):
        with self.assertRaises(GitHubError):
            self.service.begin_manifest(public_base_url='http://attacker.invalid')

    def test_finish_manifest_configures_connection_once(self):
        start = self.begin()
        conn = self.service.finish_manifest(start['state'], 'abc')
        self.assertEqual(conn['app_id'], '42')
        self.assertEqual(conn['slug'], 'opendevin-a1b2c3')
        self.assertEqual(conn['status'], 'configured')
        self.assertTrue(any(v == self.pem.encode() for v in self.vault.values.values()), 'private key not stored in vault')
        conversion = [r for r in self.remote.requests if r.path.startswith('/app-manifests/')][0]
        self.assertNotIn('Authorization', conversion.headers)
        with self.assertRaises(GitHubError) as e:
            self.service.finish_manifest(start['state'], 'abc')
        self.assertEqual(e.exception.code, 'manifest_state_invalid')

    def test_finish_manifest_rejects_expired_and_unknown_state(self):
        start = self.begin()
        self.now += 600001
        for state in (start['state'], 'not-a-state'):
            with self.assertRaises(GitHubError) as e:
                self.service.finish_manifest(state, 'abc')
            self.assertEqual(e.exception.code, 'manifest_state_invalid')

    def test_conversion_failure_is_reported(self):
        start = self.begin()
        self.remote.conversion_status = 422
        with self.assertRaises(GitHubError) as e:
            self.service.finish_manifest(start['state'], 'abc')
        self.assertEqual(e.exception.code, 'manifest_conversion_failed')

    def test_secrets_never_logged_or_returned(self):
        stream = io.StringIO(); handler = logging.StreamHandler(stream)
        logging.getLogger().addHandler(handler); self.addCleanup(logging.getLogger().removeHandler, handler)
        start = self.begin()
        conn = self.service.finish_manifest(start['state'], 'abc')
        text = json.dumps(conn) + stream.getvalue()
        for secret in ('CLIENT-SECRET-VALUE', 'WEBHOOK-SECRET-VALUE', 'PRIVATE KEY'):
            self.assertNotIn(secret, text)
        self.assertFalse(any(b'CLIENT-SECRET-VALUE' in v or b'WEBHOOK-SECRET-VALUE' in v for v in self.vault.values.values()))

    def test_routes_start_and_callback_redirect(self):
        api = FeatureAPI(self.platform, self.service, None, public_base_url='http://127.0.0.1:8765')
        start = api.dispatch('POST', '/api/github/manifest/start', body={}).body
        self.assertEqual(start['manifest']['setup_url'], 'http://127.0.0.1:8765/api/github/callback')
        ok = api.dispatch('GET', '/api/github/manifest/callback', 'code=abc&state=' + start['state'])
        self.assertEqual((ok.status, ok.headers['Location']), (303, '/#/settings/github?github=manifest_created'))
        again = api.dispatch('GET', '/api/github/manifest/callback', 'code=abc&state=' + start['state'])
        self.assertEqual(again.headers['Location'], '/#/settings/github?github=manifest_state_invalid')


if __name__ == '__main__':
    unittest.main()
