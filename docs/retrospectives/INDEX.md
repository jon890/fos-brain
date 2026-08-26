# 실행 회고

| ID | 날짜 | plan | 제목 | 상태 | 승격 |
| --- | --- | --- | --- | --- | --- |
| RETRO-0001 | 2026-08-18 | plan1-okf-retrieval-visualization | 실행 환경과 측정 대상이 빠진 계획 | 해결 | 승격 안 함 |
| RETRO-0002 | 2026-08-18 | plan1-okf-retrieval-visualization | 기존 lockfile 형식 불일치가 통합 검사를 막음 | 해결 | 승격 안 함 |
| RETRO-0003 | 2026-08-18 | plan1-okf-retrieval-visualization | 묶음 전체가 아닌 wiki만 검사해 OKF 규격 위반을 놓침 | 해결 | docs/code-architecture.md |
| RETRO-0004 | 2026-08-18 | plan1-okf-retrieval-visualization | 검증에서 HOME을 임시 경로로 바꿔 환경 계약을 어김 | 해결 | 승격 안 함 |
| RETRO-0005 | 2026-08-18 | plan2-cloudflare-access-home-server | 컨테이너 패키지 캐시가 저장소에 남음 | 해결 | 배포 회귀 검사 |
| RETRO-0006 | 2026-08-18 | plan2-cloudflare-access-home-server | Linux에서 public 홈 파일 대소문자가 달라짐 | 해결 | public 산출물 계약 |
| RETRO-0007 | 2026-08-18 | plan2-cloudflare-access-home-server | Pending 영역에서 Access 애플리케이션 생성이 거부됨 | 해결 | DNS 전환 격리 절차 |
| RETRO-0008 | 2026-08-20 | plan2-cloudflare-access-home-server | Tunnel HTTP 원본이 Force SSL 리다이렉트를 반복함 | 해결 | Tunnel HTTPS 원본 계약 |
| RETRO-0009 | 2026-08-20 | plan2-cloudflare-access-home-server | 같은 디렉터리 상대 private URL을 누출 검사에서 놓침 | 해결 | public 배포 누출 검사 |
| RETRO-0010 | 2026-08-20 | plan3-protected-private-brain | Linux fixture 산출물이 root 소유로 남음 | 해결 | 배포 회귀 검사 |
| RETRO-0011 | 2026-08-20 | plan3-protected-private-brain | 동기화 잠금이 checkout을 스스로 dirty하게 만듦 | 해결 | docs/data-schema.md |
| RETRO-0012 | 2026-08-20 | plan3-protected-private-brain | mock renderer가 Quartz output 초기화를 놓침 | 해결 | 배포 회귀 검사 |
| RETRO-0013 | 2026-08-20 | plan3-protected-private-brain | merge 전 배포가 새 산출물을 untracked로 만듦 | 해결 | 배포 순서 계약 |
| RETRO-0014 | 2026-08-25 | plan5-knowledge-quality-contract | 설치된 CLI에서 plugin eval을 실행할 수 없었음 | 해결 | 승격 안 함 |
