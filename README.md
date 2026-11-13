# Repo Ask

Select a set of Git repositories, ask an engineering question, and open the cited source lines beside the result. Repo Ask is a small, read-only, local prototype for understanding a feature that spans repositories.

## Product planning

The planned OpenDevin product is described in the [Master PRD](Master%20PRD.md), with [12 detailed feature specifications](docs/features). These documents describe future capabilities; the application below remains the current read-only prototype.

The [Codex + Claude development workflow](docs/agents/README.md) defines agent personas, task ownership, worktree isolation, review gates and the tmux runbook. Product implementation has not started.

## Run the sample

Use Python 3.10 or later with SQLite FTS5. Git is required when adding your own checkouts.

```sh
python3 -m repoask
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765) and select **Trace checkout**, then **Ask**. The bundled source fixtures show a TypeScript storefront, a Spring Boot API, a SQL migration, and a Kafka consumer. Click a result to see its numbered source lines. Match cards link both sides of HTTP paths, SQL tables, and event topics when the index retrieves them. These are literal matches and can be ambiguous in larger systems.

## Ask a local model

With [Ollama](https://ollama.com/download) running locally, pull a model and start the app in answer mode.

```sh
ollama pull qwen2.5-coder:3b
python3 -m repoask --model qwen2.5-coder:3b
```

The model is configurable. Repo Ask sends the question and retrieved excerpts to the loopback Ollama endpoint. Use a downloaded local model for local-only inference. In search mode, no model is called. Generated answers are grouped into sections with clickable citations. The server checks that citation IDs refer to retrieved excerpts. Check the source itself to verify the interpretation.

## Index your own repositories

```sh
python3 -m repoask \
  --repo web=/path/to/storefront \
  --repo api=/path/to/orders-api \
  --repo db=/path/to/orders-db \
  --model qwen2.5-coder:3b
```

Use up to eight Git checkout roots. The app indexes committed text files from each checkout's `HEAD` and keeps the index in memory. Restart it after changing a branch or committing changes. Citations include the indexed commit, and the code pane reads the same snapshot. Conversation history lasts for the current browser page. Changing the repository selection starts a new conversation.

The index recognizes common code and configuration extensions, skips hidden paths, symlinks, and common build and vendor directories, and caps each repository at 4,000 files or 12 MiB of selected source. The repository picker reports when a limit is hit. Use public or synthetic repositories for demos. Repo Ask binds to loopback for single-user use.

Run the tests with `python3 -m unittest discover -s tests`.

## What to build next

1. Create a public evaluation set with questions about request flow, configuration, database writes, event producers and consumers, and missing evidence. Record the expected commit, file and line range for each step. Measure how many required steps appear in the first ten results and how many cited passages support the answer.
2. Add framework-aware lookup for Spring routes and Feign clients, Kafka topics, and SQL migrations. Track how often a linked pair is correct across repositories, including cases with matching names in unrelated services.
3. Compare lookup quality and time to a verified answer against [Sourcebot](https://docs.sourcebot.dev/docs/features/ask/ask-sourcebot). It already supports cross-repository search, Q&A, and side-by-side code citations. Use it as a baseline for the evaluation set.

Released under the [MIT License](LICENSE).
