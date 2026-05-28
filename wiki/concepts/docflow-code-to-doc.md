---
type: concept
created: 2026-05-19
updated: 2026-05-19
---

# DocFlow (Code-to-Doc)

토스 프론트엔드의 JSDoc 기반 문서 자동 생성·검증 파이프라인. 코드 변경이 일어나면 문서 최신성을 CI 단계에서 강제해 기술 부채를 막는다.

## 핵심 포인트

- **메커니즘**: JavaScript 메소드의 JSDoc 주석 (설명·파라미터·예제) 을 파싱해 문서로 컴파일.
- **CI 강제**: 사내 라이브러리에 새 메소드가 추가되면 JSDoc 이 없으면 빌드 실패 → 문서화가 PR 의 통과 조건.
- **3단계 리뷰**: 개발자 (기술 검증) → 테크니컬 라이터 (구조·가독성) → 배포.
- **목적**: RAG Ingestion 의 입력 신뢰성 확보. "문서 최신화 비용" 을 코드 변경 시점으로 당겨 분산.
- **보완**: SilokBot (실록봇) — Slack 의 기술 논의 쓰레드를 요약해 자동 PR 생성, 휘발성 지식 보존.

## 관련 개념

- [[toss-park-ssi-rag]] — DocFlow 가 공급하는 문서를 박씨가 검색·생성에 사용
- [[sionic-vlm-document-parsing]] — DocFlow 는 코드→텍스트 변환이라 파싱 이슈가 거의 없음, Sionic 의 복잡 문서 파싱 문제와 대조

## 관련 주제

- [[../topics/rag-system-architecture-strategies]]

## Sources

- [[../../raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf]] (5페이지)
- [[../../raw/notes/다른 기업의 RAG 시스템 발표자료.md]]
