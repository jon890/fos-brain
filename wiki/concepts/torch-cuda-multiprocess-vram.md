---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# torch.cuda 메모리 메트릭은 멀티프로세스 워커의 실제 VRAM 을 못 본다 — DCGM 이 정확

메인 프로세스에서 `torch.cuda.memory_allocated/reserved` 로 읽는 GPU 메모리 값은 별도 워커 프로세스가 점유한 VRAM 을 보지 못하므로, GPU 디바이스 전체를 보는 DCGM exporter 가 더 정확하다.

## 핵심 포인트

- torch.cuda 메모리 조회는 호출한 프로세스 관점만 본다 — 워커가 별도 프로세스면 워커의 실제 점유가 안 잡힌다.
- 한 프로젝트의 `/status/gpu` 엔드포인트는 메인 프로세스의 torch 컨텍스트만 읽는데, 실제 파싱은 별도 워커 프로세스에서 일어나 메인 기준 값이 워커 VRAM 을 못 본다.
- DCGM exporter 는 GPU 디바이스 전체(모든 프로세스 합)를 보므로 allocated·reserved·utilization 모두 더 정확하다.
- 그래서 프로세스 내부 GPU 조회 엔드포인트는 관측 단일 소스로 부적합해 제거 대상이 된다.
- 단, `get_gpu_memory_info()` 함수 자체는 startup 로그·워밍업에서 쓰이므로 엔드포인트만 제거하고 함수는 존치한다.

## Sources

- 원본: work 네임스페이스에서 이관 (일반화)
