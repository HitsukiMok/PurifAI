# PurifAI Technical Details:


## AI Architecture

PurifAI's core intelligence is powered by a fine-tuned **DeBERTa v3** model optimized for fast, accurate classification of adversarial prompts. To counteract complex attacks without sacrificing usability, the inference pipeline employs a strict **Heuristic Veto logic**—ensuring explicit injection attempts (e.g., "ignore all previous instructions") are never accidentally downgraded by generic text heuristics. 

For large document processing, the system utilizes a **Sliding-Window Chunking** algorithm. This algorithm dynamically breaks extensive PDFs and text files into 400-word blocks with 50-word overlaps. This ensures no malicious payload can sneak across chunk boundaries while strictly adhering to the DeBERTa model's 512-token context limit.

---


## Backend Infrastructure

The PurifAI backend is built on **FastAPI** to provide ultra-low latency inference for our client extensions. To maintain absolute data security, all file parsing relies on a **Zero-Disk-IO** architecture using `io.BytesIO`. This guarantees that sensitive document payloads are evaluated entirely in-memory and immediately discarded.

The API exposes two primary endpoints:
* `POST /api/scan`: For rapid, debounced evaluation of raw text and email bodies.
* `POST /api/scan-file`: For multipart document uploading and chunked processing.

To prevent abuse and mitigate self-triggering UI loops, both endpoints are fortified with custom, in-memory IP rate limiting (`FILE_RATE_LIMITS`), ensuring graceful degradation via `HTTP 429 Retry-After` headers under heavy load.

---


## Frontend & Extension UI

The Chrome Extension serves as the user's primary line of defense. To prevent "Time-of-Check" vulnerabilities during Gmail interactions, it injects an optimistic **Glass Shield** overlay. This blurred shield aggressively locks down the email body during inference, dissolving only when a "Safe" verdict is returned. 

To ensure stability against dynamic DOM environments, the frontend utilizes an **Ultimate Debounce Circuit Breaker**. This strict 250ms quiet-DOM timer eliminates the infinite `MutationObserver` loops typically caused by injecting UI elements into active single-page applications.

For manual document processing, users have access to the **Extension Popup Dashboard**—a sleek, isolated drag-and-drop interface accessible directly from the browser toolbar, allowing for quick, manual file vetting without relying on brittle DOM hooks.
