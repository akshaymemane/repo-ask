#!/usr/bin/env python3
"""Offline latency baseline. Harness uses stdlib plus existing app/test dependencies.

Reproduces evaluate()'s setup from test_ask_routing_evaluation, without its
post-evaluation mutations. No HTTP server, network, provider or model calls.
"""
import argparse
from contextlib import contextmanager
import json
import math
import os
from pathlib import Path
import platform
import sqlite3
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / 'tests')]


@contextmanager
def fixture():
    import test_github_service as github_fixture
    from repoask.ask import RoutingService
    from repoask.indexing import IndexService
    from repoask.platform.worker import Worker
    from repoask.providers import ProviderService

    data = json.loads((ROOT / 'tests/fixtures/routing/catalog.json').read_text())
    test = github_fixture.GitHubTests(methodName='runTest')
    test.setUpClass()
    index = None
    try:
        test.setUp()  # TemporaryDirectory, real SQLite, in-memory vault, fake transport.
        test.remote.repos['11'] = []
        for i, repo in enumerate(data['repositories'], 1):
            record = github_fixture.repo(i, repo['name'])
            record.update(description=repo['profile'], topics=[])
            test.remote.repos['11'].append(record)
        test.refresh()

        def reader(source, revision, caps):
            i = int(source['id'].split(':')[1]) - 1
            return {'revision': 'a' * 40, 'revision_kind': 'git', 'branch': 'main',
                    'files': [{'path': 'README.md',
                               'content': data['repositories'][i]['profile'].encode()}]}

        index = IndexService(test.platform.store, test.platform.jobs, test.service,
                             ProviderService(test.platform.store, None), snapshot_reader=reader)
        for i in range(1, 26):
            run = index.request_index('gh:' + str(i))
            Worker(test.platform.jobs, {'index.run': index.run_index},
                   worker_id='fixture').run_once()
            if index.get_run(run['id'])['state'] != 'completed':
                raise RuntimeError('Fixture indexing failed')
        # Fail closed if any measured operation unexpectedly attempts transport.
        def offline(request):
            raise RuntimeError('Unexpected transport during measurement')
        test.service.client.transport = offline
        yield test, index, RoutingService(test.platform.store, index), data
    finally:
        if index is not None:
            index.vectors.close()
        test.doCleanups()


def summary(values):
    ordered = sorted(values)
    def percentile(p):
        return ordered[max(0, math.ceil(len(ordered) * p) - 1)]
    return {'samples': len(values), 'p50_ms': percentile(.5),
            'p95_ms': percentile(.95), 'max_ms': max(values)}


def timed(call):
    start = time.perf_counter_ns()
    result = call()
    return (time.perf_counter_ns() - start) / 1_000_000, result


def benchmark(reads, repeats, prompt_limit):
    with fixture() as (test, index, routing, data):
        prompts = data['tasks'][:prompt_limit]
        # UI emits only optional query, plus limit=100 and cursors. Cover empty,
        # broad multi-page, selective and no-match searches, not invented UI filters.
        variants = {'all': '', 'broad': 'owner', 'selective': 'billing',
                    'no_match': 'zzzz-no-such-repository'}
        calls = []
        cold = {}
        cold_values = []
        for label, query in variants.items():
            cursor = None
            values = []
            while True:
                kwargs = dict(limit=100, query=query, cursor=cursor)
                elapsed, page = timed(lambda: test.service.list_repositories(**kwargs))
                values.append(elapsed)
                cold_values.append(elapsed)
                calls.append((label, kwargs))
                cursor = page['next_cursor']
                if cursor is None:
                    break
            cold[label] = summary(values)
        route_cold = [timed(lambda p=p: routing.route(p['prompt']))[0] for p in prompts]
        # Explicit full warm-up, unmeasured; route() persists each decision, as in production.
        for _, kwargs in calls:
            test.service.list_repositories(**kwargs)
        for prompt in prompts:
            routing.route(prompt['prompt'])
        warm = {label: [] for label in variants}
        # N reads per distinct variant/page, rather than hiding later pages in aggregate.
        pages = []
        for label, kwargs in calls:
            values = [timed(lambda: test.service.list_repositories(**kwargs))[0]
                      for _ in range(reads)]
            warm[label].extend(values)
            pages.append({'variant': label, 'page': 1 + sum(p['variant'] == label for p in pages),
                          **summary(values)})
        route_values = []
        per_prompt = []
        for position, prompt in enumerate(prompts, 1):
            values = [timed(lambda: routing.route(prompt['prompt']))[0]
                      for _ in range(repeats)]
            route_values.extend(values)
            per_prompt.append({'prompt_number': position, **summary(values)})
        catalog_values = [v for values in warm.values() for v in values]
        with test.platform.store.read() as db:
            chunks = db.execute('SELECT count(*) FROM code_chunks').fetchone()[0]
        catalog_summary = summary(catalog_values)
        routing_summary = summary(route_values)
        return {
            'environment': {'python': platform.python_version(), 'sqlite': sqlite3.sqlite_version,
                            'platform': platform.platform(), 'processor': platform.processor(),
                            'cpu_count': os.cpu_count()},
            'fixture': {'repositories': len(data['repositories']), 'indexed_repositories': 25,
                        'chunks': chunks, 'files_per_indexed_repository': 1,
                        'file_content': 'synthetic profile in README.md', 'labelled_prompts': len(prompts),
                        'embedding_models': 0},
            'method': {'percentile': 'nearest rank', 'reads_per_variant_page': reads,
                       'routing_repeats_per_prompt': repeats,
                       'cold': 'first-use after fixture construction; OS/SQLite caches not flushed',
                       'warm': 'same process/database after full unmeasured warm-up',
                       'scope': 'service calls only; no HTTP/JSON/browser, network, clone, model or container startup'},
            'catalog': {'queries': variants, 'cold_by_variant': cold,
                        'cold': summary(cold_values),
                        'warm': catalog_summary, 'warm_by_variant': {k: summary(v) for k, v in warm.items()},
                        'warm_by_page': pages},
            'routing': {'cold': summary(route_cold), 'warm': routing_summary,
                        'warm_by_prompt': per_prompt},
            'gates': {'catalog_p95_under_1000_ms': catalog_summary['p95_ms'] < 1000,
                      'routing_p95_under_2000_ms': routing_summary['p95_ms'] < 2000}}


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError('must be positive')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog-reads', type=positive, default=100,
                        help='warm reads per query variant/page (default: 100)')
    parser.add_argument('--routing-repeats', type=positive, default=5)
    parser.add_argument('--prompt-limit', type=positive, default=50,
                        help='reduce prompts for smoke checks; full baseline uses all 50')
    parser.add_argument('--assert', dest='assert_gates', action='store_true')
    args = parser.parse_args()
    result = benchmark(args.catalog_reads, args.routing_repeats, args.prompt_limit)
    print(json.dumps(result, indent=2))
    return int(args.assert_gates and not all(result['gates'].values()))


if __name__ == '__main__':
    sys.exit(main())
