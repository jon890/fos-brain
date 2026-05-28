---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# K8s /run tmpfs 포화로 Pod 안 뜸 (containerd 메타데이터)

루트 디스크는 여유인데 Pod 가 `ContainerCreating` 에서 멈추는 장애.
`/run` tmpfs(RAM 파일시스템) 포화가 원인이다.

## 핵심 메커니즘

- `/run` 은 RAM 위 tmpfs 라 루트 디스크와 **독립적으로** 꽉 찰 수 있다.
- containerd shim v2 는 **컨테이너당 task 디렉터리**를 `/run/containerd/.../` 에 만든다.
  - `config.json`(OCI 스펙), `log`(FIFO), `address`(소켓), `rootfs/`(overlay 마운트 포인트)
- overlay 마운트 포인트가 `/run` 에 있어, 커널이 그 아래 **dentry·inode 메타데이터**를 tmpfs 공간에 생성한다.
- 이미지 레이어가 많을수록(예: LLM 이미지 약 50 lowerdir) + 컨테이너 수가 많을수록 메타데이터가 누적돼 tmpfs 를 소진한다.

## 진단

- `df -h /run` 과 `df -h /` 를 **분리**해서 본다. 루트가 여유여도 `/run` 이 100% 일 수 있다.
- `du -sx /run/containerd/` — **`-x` 필수**. 없으면 overlay 마운트를 따라가 `/var/lib/containerd` 이미지까지 합산해 엉뚱한 수(50G) 가 나온다.
- 영구 데이터(이미지·스냅샷)는 `/var/lib/containerd/`(루트 디스크), 런타임 메타는 `/run`(tmpfs) — 경로가 갈린다.

## 해결

- 즉시: `sudo mount -o remount,size=16G /run` (기존 데이터 유지, 재부팅 시 원복).
- 영구: `/etc/fstab` 에 `tmpfs /run tmpfs defaults,size=16G 0 0`.
- tmpfs 는 "최대 허용량"이지 즉시 할당이 아니다 → 큰 RAM 노드에서 안전.

## 사례·후속

- NHN Cloud OCR 리얼 배포에서 GPU(LLM) 노드의 `/run`(8.9G) 포화로 ocr-api Pod 가 안 떴다(application 노드는 정상).
- nvidia-container-runtime 과도 로깅 버그(NVIDIA toolkit #511)가 `/run` 을 채우는 경우도 있어 toolkit 업그레이드·로그 경로 변경을 검토한다.

## 관련 개념

- [[../topics/observability]] — 배포 장애 탐지·진단과 연결

## Sources

- fos-study: `devops/k8s/gpu-node-run-tmpfs-full.md`
