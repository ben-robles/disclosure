FROM ollama/ollama:0.40.10
ARG MODEL=gemma4:e4b
ENV OLLAMA_HOST=0.0.0.0:8080 \
    OLLAMA_KEEP_ALIVE=-1 \
    OLLAMA_NUM_PARALLEL=4 \
    OLLAMA_DEBUG=false
# Pull weights at build time so cold start is a model load, not a 9.6 GB download.
RUN ollama serve & \
    for i in $(seq 1 30); do ollama list >/dev/null 2>&1 && break; sleep 1; done; \
    ollama pull "$MODEL" && \
    ollama list && \
    kill $!
EXPOSE 8080
ENTRYPOINT ["ollama", "serve"]
