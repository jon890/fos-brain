# ADR-003: private wiki는 Access 보호 release로만 게시한다

- **결정**: public 전용 Quartz 산출물은 private 입력을 계속 금지한다.
  `brain.fosworld.co.kr`에는 public과 private의 컴파일된 wiki만 포함한 별도 release를 만들고 Cloudflare Access 뒤에서 제공한다.
  검증된 새 release는 `current` 링크로 원자적으로 전환하며 GitHub 웹훅이 두 저장소의 `main` 변경을 같은 Jenkins 작업으로 갱신한다.
- **맥락**: private 저장소에는 개인 건강, 재무, 커리어 자료가 있어 공개 산출물이나 public git 이력에 섞이면 복구가 어렵다.
  반면 사람은 public과 private 지식을 같은 그래프에서 읽어야 하며, 현재 `brain` 원점은 Access와 loopback 경계로 보호된다.
  public과 private 저장소는 독립적으로 갱신되므로 빌드 실패와 동시 push에서도 직전 정상 화면을 유지해야 한다.
- **대안 기각**: private를 `quartz/public`에 함께 빌드하는 안은 public-only 검증과 배포 경계를 무너뜨리므로 기각한다.
  별도 private 호스트를 만드는 안은 그래프와 검색을 다시 분리하고 Access 정책을 중복 관리하므로 기각한다.
  private raw까지 원격으로 제공하는 안은 사람이 읽는 컴파일 지식보다 노출 범위가 커지므로 기각한다.
- **트레이드오프**: 보호 빌드는 두 저장소의 상태와 Jenkins 웹훅에 의존한다.
  대신 private 자료를 public 산출물과 git에서 분리하고 빌드 실패 시 직전 release로 되돌릴 수 있다.
