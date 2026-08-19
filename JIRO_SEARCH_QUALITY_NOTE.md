# Separate Jiro Search-Quality Issue

The reported `jiro ask "best python scraping library?"` response is not a Kiwi Router gateway failure. The retrieved source set was dominated by unrelated pages matching the word “best,” so the answer correctly declined to rely on those sources but did not satisfy the user’s intent.

A proper Jiro fix belongs in its search/retrieval pipeline: classify the query intent, improve lexical and semantic ranking, require topical relevance before synthesis, and return an explicit “no relevant sources” result when the candidate set is unrelated. Kiwi Router’s `/api/v1/chat/completions` 502 repair is tracked and implemented separately.
