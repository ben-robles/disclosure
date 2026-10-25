# Environment — Windows demo measurements pending

Certification target: the Windows demo laptop specified in planning/PLAN.md.
The current development session is on an Apple Silicon Mac; its specifications
and test timings do not represent the certification machine.

Run `scripts/gate0_windows.ps1` from the Windows repository checkout as described
in [Gate 0](gate0.md). It captures the Windows version/build, physical RAM,
video controller/driver, NVIDIA VRAM where available, Python, Git, Ollama versions,
and free space on the repository drive into `data/gate0/<run>/environment.json`.
The same run produces a draft `environment.md` to copy here after reviewing it.

| Field | Windows result |
|---|---|
| Windows version/build | Pending |
| RAM | Pending |
| GPU / VRAM / driver | Pending |
| Python (3.11+ required) | Pending |
| Git | Pending |
| Ollama client/server | Pending |
| Free disk on repository and model drives | Pending |

Ollama normally stores models under the Windows user's `.ollama/models` directory.
The wrapper records that path (or `OLLAMA_MODELS` if set) and available space on
its drive separately from the repository drive. If measurement is unavailable,
record model-drive free space manually before pulling weights.
