# PurifAI Technical Details

## Core AI Architecture & Inference Engine

PurifAI’s intelligence is powered by a fine-tuned **DeBERTa v3** model, specifically trained by security researchers to detect adversarial prompt injections and jailbreak attempts.

To maximize data privacy and bypass rigid external API rate limits, the inference pipeline does not rely on third-party LLMs. Instead, the model runs **100% local inference via PyTorch** directly within our containerized backend.

To counteract complex attacks without sacrificing usability, the pipeline employs a dual-layered filtering system:

1. **Payload Sanitization & Heuristic Veto:** Before the model reads the text, the backend aggressively sanitizes the payload by stripping complex tracking URLs, zero-width spaces (`\u200B`), and invisible unicode characters that attackers use to confuse standard NLP tokenizers. Explicit jailbreak regexes immediately veto the model and flag the payload as dangerous.
    
2. **The 85% Confidence Threshold:** Standard AI models frequently output false positives on dense, technical corporate emails. PurifAI enforces a strict probability threshold. If the model flags an injection but is less than 85% confident, the system overrides the verdict to "Safe," ensuring zero friction for standard daily workflows.
    

For large document processing, the system utilizes a **Sliding-Window Chunking** algorithm. This algorithm dynamically breaks extensive PDFs and text files into 400-word blocks with 50-word overlaps. This overlap acts as a mathematical net, ensuring no malicious payload can execute by sneaking across chunk boundaries, while strictly adhering to the DeBERTa model's 512-token context limit.

---

## Backend Infrastructure & Deployment

The PurifAI backend is built on **FastAPI** to provide ultra-low latency routing.

**The Infrastructure Pivot (Vercel to Docker):** Initially deployed on Vercel Serverless Functions, the architecture encountered a critical limitation: loading heavy machine learning models into memory takes time, and Vercel enforces a hard 10-second execution kill-switch on free tiers. To permanently resolve this, the backend was migrated to a dedicated **Hugging Face Docker Space** (2 vCPUs, 16GB RAM).

This containerized approach allows the FastAPI server to load the 500MB+ DeBERTa model globally into RAM upon startup. Subsequent requests bypass the cold start entirely. Thread tuning (`OMP_NUM_THREADS="2"`) forces the PyTorch engine to fully saturate the available dual-core CPU for maximum free-tier performance.

**Zero-Disk-IO:** To maintain absolute data security and SOC2-adjacent compliance, all file parsing relies on a **Zero-Disk-IO** architecture. Document payloads (`/api/scan-file`) are loaded directly into RAM using `io.BytesIO`. Files are evaluated in-memory and immediately garbage-collected, ensuring malicious payloads never touch a persistent filesystem.

Telemetry and threat logs are dispatched asynchronously to a **Supabase (PostgreSQL)** database for the React Command Center Dashboard, ensuring the user's API response is never bottlenecked by database write times.

---

## Frontend & Extension UI Architecture

The Chrome Extension (Manifest V3) serves as the user's primary line of defense inside Gmail.

**Single-Shot Hash Listener Architecture:** Injecting custom UI elements into a massive Single-Page Application (SPA) like Gmail using standard `MutationObserver` patterns frequently results in infinite rendering loops and browser crashes. PurifAI abandons the DOM observer entirely. Instead, it utilizes an event-driven **URL Hash Listener**. When the Gmail URL `#hash` changes (indicating an email was opened), the extension waits exactly 800ms for network resolution, fires a _single_ scan, and goes back to sleep.

**Deep Scan Head-and-Tail Extraction:** Standard extensions use `.innerText` to read websites, which is critically flawed for security: it ignores text hidden via CSS (`display: none`, `font-size: 0px`, or white-on-white text). PurifAI mitigates this through two extraction techniques:

1. **See the Invisible:** The extension extracts `.textContent`, bypassing the CSS rendering tree to catch hidden payload traps.
    
2. **The Head-and-Tail Diet:** Attackers often hide prompt injections at the very bottom of massive email threads. Instead of blindly sending 50,000 characters to the CPU (which causes severe latency) or truncating the string (which deletes the attack), the extension extracts the **first 1500** and **last 1500** characters. This compresses the payload to a manageable size for the 512-token model limit while mathematically guaranteeing the attack vector is captured.
    

**The Glass Shield Protocol:** To prevent "Time-of-Check" vulnerabilities, the UI employs an optimistic **Glass Shield** overlay. When a user clicks an email, the shield instantly renders over the `.a3s` message container, physically blurring the text during API inference. On a "Safe" verdict, the shield smoothly dissolves. On an "Injection" verdict, the shield locks down permanently with a high-contrast warning banner. To maintain SPA hygiene, a "Clean Slate Wipe" protocol aggressively removes ghost shields upon every new navigation event.