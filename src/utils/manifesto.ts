/**
 * Contains the content of the SmarterRouter Technical Manifesto.
 * This markdown string describes the architecture, features, and philosophy
 * of the platform.
 */
export const manifestoContent = `
# SmarterRouter: Intelligent Hybrid LLM Orchestration & Multi-Agent Platform
**Technical Manifesto & Architecture Overview**

## 1. Abstract
SmarterRouter is an advanced, privacy-first, hybrid Large Language Model (LLM) orchestration platform and multi-agent development ecosystem. It dynamically routes inference requests between local edge models and frontier cloud models, while providing a comprehensive suite of specialized autonomous agents for training, merging, evaluating, and researching LLMs.

## 2. Recent Developments (Phases 1-5 Implementation)
The platform has recently undergone a major architectural upgrade, successfully implementing a robust Node.js/React full-stack environment:
- **Phase 1 (Backend Foundation):** Established an Express.js server to bridge the gap between the secure browser environment and the local file system, enabling true Obsidian MCP integration.
- **Phase 2 (Semantic Cache & Storage):** Implemented SQLite database initialization for persistent semantic caching, improving response times for repeated queries.
- **Phase 3 (Multi-Agent Protocol):** Developed the LLM-CL (LLM Communication Language) for compressed inter-agent communication, alongside a robust Job Queue API for asynchronous task management.
- **Phase 4 (Asynchronous UI):** Upgraded the Dashboard to fetch real-time agent statuses and job progress via polling, providing a live view of the multi-agent ecosystem.
- **Phase 5 (Master Orchestrator - MaAS):** Integrated Gemini 3.1 Pro as the central intelligence layer. The orchestrator now analyzes user intents to dynamically route requests to direct answers, local models, or trigger complex asynchronous agent jobs.
- **Phase 6 (Workflow Chaining & Model Strategies):** Implemented a robust multi-step LLM pipeline engine. Introduced the Strategy Pattern for seamless integration with multiple providers (Gemini, OpenAI, Anthropic, Groq, DeepSeek). Added a visual Workflow Builder UI to construct, monitor, and execute complex chains with dynamic context interpolation and automated retries.

## 3. Core Architectural Design

### 3.1. Advanced Orchestration: Adaptive Controller (MaAS Inspired)
Moving beyond simple contextual routing, the system employs an Adaptive Controller inspired by Model-as-a-Service (MaAS) paradigms.
- **Dynamic Composition:** Analyzes incoming requests to dynamically select and instantiate a multi-agent architecture (e.g., a single I/O agent for simple tasks, or a collaborative team of planner, researcher, and coder for complex tasks).
- **Feedback Loop:** The controller learns from past performance metrics to optimize future routing and agent selection decisions.

### 3.2. Specialized Multi-Agent System
The platform hosts dedicated autonomous agents to manage the entire LLM lifecycle:
- **Trainer Agent:** Executes fine-tuning (LoRA, QLoRA) on local datasets using libraries like Transformers, PEFT, and Unsloth.
- **Merger Agent:** Utilizes Mergekit to fuse multiple models using advanced techniques (Model Stock, TIES, DARE).
- **Evaluator Agent:** Benchmarks models against standard datasets (MMLU, ARC, HellaSwag) and generates comparative reports.
- **Research Agent:** Enriches datasets via web search (Ollama Web Search, SearXNG) and generates synthetic examples.
- **Verifier Agent:** Applies a 4-step Chain of Verification (CoVe) to mitigate hallucinations in master model responses.

### 3.3. Inter-Agent Communication: LLM-CL
To maximize efficiency and precision, agents communicate using the LLM Communication Language (LLM-CL).
- **Encoder/Decoder:** Translates natural language requests into a highly compact format, reducing token overhead by 50-75%.
- **Robust Parsing:** Utilizes comprehensive regex-based parsing to ensure strict adherence to the communication protocol across all router and master components.

## 4. Knowledge Base & Storage Architecture

### 4.1. Obsidian Integration (Model Context Protocol)
SmarterRouter deeply integrates with Obsidian to maintain a persistent, text-based workflow and knowledge base.
- **MCP Server:** Exposes tools to read/write notes, execute Dataview queries, and navigate the knowledge graph via the Node.js backend.
- **Directory Watcher:** Monitors specific vault directories (e.g., \`AI/Requests\`) to trigger agents automatically, writing outputs back to \`AI/Responses\`.

### 4.2. 4-Level Persistence & Storage
The memory architecture is designed for both immediate context and long-term persistence:
- **L1 (Working Memory):** In-memory cache (Redis/Dict) for recent, exact-match queries.
- **L2 (Episodic Memory):** Semantic cache persisted via SQLite using embeddings.
- **L3 (Semantic Memory):** Integration with Obsidian and local vector databases (e.g., ChromaDB) for Retrieval-Augmented Generation (RAG).
- **L4 (Compute):** Execution layer (Local/Cloud).
- **Metadata Database:** SQLite for storing project configurations, agent logs, and profiling metrics.

## 5. Model Management & Execution

### 5.1. Model Hub & Versioning
- **Hugging Face Integration:** Seamlessly searches and downloads public models via \`huggingface_hub\` (GGUF, ONNX, native).
- **Versioning System:** Every fine-tuned or merged model receives a unique hash-based ID, metadata tracking (parent model, hyperparameters), and rollback capabilities.
- **Interactive UI:** React-based guided forms for initiating training/merging jobs, visualizing loss graphs in real-time, and previewing models.

### 5.2. Master Arbitrator & Cloud Providers
- **MasterOrchestrator:** Acts as the primary arbitrator, utilizing Gemini 3.1 Pro for complex reasoning with strict rate limiting and fallback to local models (e.g., Qwen, Phi-3).
- **Extended Cloud Integration:** Dynamically routes to specialized providers based on task requirements: Groq (ultra-fast generation), Together AI (multimodal/vision), Cerebras (low-cost batch processing), and Ollama Web Search (fresh grounding).

## 6. Infrastructure & Security

### 6.1. Asynchronous Task Management
- **Job Queues:** Utilizes a robust SQLite-backed job queue to manage long-running operations (training, merging).
- **Dedicated Workers:** Python-based worker processes handle heavy compute tasks, communicating with the React frontend via REST APIs for real-time status updates.

### 6.2. Cross-Platform Frontend
- **React Native Porting:** The architecture supports extending the React web interface to iOS/Android using React Native.
- **Mobile Inference:** Capable of running quantized models natively on mobile devices using \`react-native-fast-tflite\` or ONNX Runtime.

### 6.3. Monitoring, Privacy & Security
- **Advanced Telemetry:** Real-time metrics (latency, VRAM usage, cache hit rates) exportable to Grafana/Prometheus.
- **Security:** Features vault encryption, multi-user authentication, and comprehensive audit logging to ensure data privacy and system integrity.

## 7. References
1. Vaswani, A., et al. (2017). "Attention Is All You Need." *Advances in Neural Information Processing Systems*.
2. Hugging Face. (2024). *Transformers.js & PEFT Documentation*.
3. Dhuliawala, S., et al. (2023). "Chain-of-Verification Reduces Hallucination in Large Language Models." *arXiv preprint*.
4. Goddard, C., et al. (2024). "Mergekit: Tools for merging pre-trained large language models."
5. Anthropic. (2024). *Model Context Protocol (MCP) Specification*.
`;
