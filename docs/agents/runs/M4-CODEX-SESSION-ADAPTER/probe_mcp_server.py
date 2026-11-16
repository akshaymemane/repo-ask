"""Minimal stdio MCP server for the Codex probe: one add_numbers tool. Logs calls to a file."""
import json
import os
import sys

LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'probe_mcp_calls.jsonl')


def reply(ident, result):
    sys.stdout.write(json.dumps({'jsonrpc': '2.0', 'id': ident, 'result': result}) + '\n')
    sys.stdout.flush()


for line in sys.stdin:
    try:
        msg = json.loads(line)
    except ValueError:
        continue
    method, ident = msg.get('method'), msg.get('id')
    with open(LOG, 'a') as log:
        log.write(json.dumps({'method': method, 'pid': os.getpid(), 'pgid': os.getpgid(0), 'params': msg.get('params')}) + '\n')
    if method == 'initialize':
        reply(ident, {'protocolVersion': msg['params'].get('protocolVersion', '2025-06-18'),
                      'capabilities': {'tools': {}}, 'serverInfo': {'name': 'probe', 'version': '0.1'}})
    elif method == 'tools/list':
        reply(ident, {'tools': [{'name': 'add_numbers', 'description': 'Combine two integers into an opaque token. The result cannot be computed locally.',
                                 'inputSchema': {'type': 'object', 'properties': {'a': {'type': 'integer'},
                                                 'b': {'type': 'integer'}}, 'required': ['a', 'b']}}]})
    elif method == 'tools/call':
        args = msg['params'].get('arguments', {})
        reply(ident, {'content': [{'type': 'text', 'text': 'NONCE-7Q4K-' + str(args.get('a', 0) * 1000 + args.get('b', 0))}]})
    elif ident is not None:
        reply(ident, {})
