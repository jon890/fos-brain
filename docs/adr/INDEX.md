# ADR 목록

이 저장소의 아키텍처 결정 기록을 번호순으로 모은다.
새 ADR을 추가하면 이 목록에도 같은 번호로 등록한다.

번호는 한 번 쓰면 재사용하지 않는다.
003은 삭제된 인프라 ADR이 쓰던 번호라 비워 둔다.
002도 같은 이유로 한 번 비었다가 다시 채워진 적이 있으므로,
다음 번호는 이 목록의 마지막 번호 다음 값으로 정한다.

파일과 목록이 어긋나지 않는지 아래 명령으로 확인한다.

```bash
# 본문 H1 번호와 목록 항목 번호가 같아야 한다
diff <(grep -hoE '^# ADR-[0-9]+' docs/adr/[0-9]*.md | grep -oE '[0-9]+$' | sort) \
     <(grep -oE '^- \[ADR-[0-9]+\]' docs/adr/INDEX.md | grep -oE '[0-9]+' | sort)

# 파일명 번호가 중복되지 않아야 한다
ls docs/adr/[0-9]*.md | grep -oE '/[0-9]+' | tr -d '/' | sort | uniq -d
```

## 목록

- [ADR-001](001-okf-compatibility-boundary.md) — OKF는 내부 형식이 아니라 외부 교환용 호환 경계로만 적용한다.
- [ADR-002](002-memory-atlas-3d-home.md) — 3D Memory Atlas runtime은 홈에서만 동적으로 불러오고 일반 문서는 기존 그래프를 유지한다.
- [ADR-004](004-brain-qmd-http-boundary.md) — qmd 검색은 애플리케이션과 분리한 내부 HTTP 서비스로 두고, 공개 저장소는 요청과 응답 계약만 소유한다.
- [ADR-005](005-brain-grounded-question-boundary.md) — Brain 근거 질문은 같은 출처 BFF의 단일 질문으로 제한하고 대화형 에이전트로 확장하지 않는다.
- [ADR-006](006-private-infrastructure-boundary.md) — 운영 구성은 private 인프라 저장소가 소유하고 공개 저장소는 코드와 일반 계약만 둔다.
- [ADR-007](007-knowledge-admission-policy.md) — 지식 유입 정책을 플러그인의 공용 참조 문서 하나에 두고 모든 brain 스킬이 같은 계약을 쓴다.
- [ADR-008](008-memory-atlas-2d-semantic-navigation.md) — 기본 탐색은 2D 혼합 관계 지도와 선택 중심 지역 관계를 사용하고 3D는 조망 모드로 유지한다.
- [ADR-009](009-claude-code-review-boundary.md) — Claude 코드 리뷰는 GitHub Actions의 읽기 전용 단일 리뷰로 실행하고 별도 GitHub App은 두지 않는다.
