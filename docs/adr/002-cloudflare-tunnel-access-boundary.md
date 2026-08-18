# ADR-002: 홈서버 공개 경계는 Cloudflare Tunnel과 Access로 통합한다

- **결정**: hosting.kr은 등록기관으로 유지하고 Cloudflare full DNS setup으로 권한 DNS만 위임한다.
  외부 HTTP 요청은 하나의 Cloudflare Tunnel을 통해 기존 Nginx Proxy Manager로 전달한다.
  공개 서비스에는 Access를 적용하지 않고 관리 서비스와 public brain에는 이메일 일회용 PIN 정책을 적용한다.
  Jenkins 웹훅 경로만 더 구체적인 Bypass 애플리케이션으로 분리하고 Jenkins에서 HMAC-SHA256을 검증한다.
- **맥락**: 홈서버는 공인 80·443을 NPM에 직접 노출하고 있으며 Grafana, Jenkins, NPM과 새 brain은 사용자 인증 경계가 필요하다.
  반면 블로그와 가계부는 로그인 없이 계속 제공해야 한다.
  Cloudflare는 등록기관 이전 없이 네임서버 위임만으로 full setup을 지원하고, Access는 더 구체적인 애플리케이션 경로를 우선한다.
- **대안 기각**: 모든 호스트에 Access를 적용하면 공개 블로그와 가계부의 요구를 깨므로 기각한다.
  서비스마다 별도 Tunnel을 두는 안은 token과 장애 지점을 늘리므로 기각한다.
  Tunnel에서 각 컨테이너로 직접 연결하는 안은 기존 NPM의 호스트 라우팅과 복구 절차를 이중 관리하게 하므로 기각한다.
  Jenkins 웹훅을 IP 허용 목록과 작업 token만으로 보호하는 안은 Cloudflare 뒤의 원본 주소 변화와 payload 위변조를 충분히 검증하지 못하므로 기각한다.
- **트레이드오프**: Cloudflare와 단일 Tunnel 장애가 모든 HTTP 서비스의 공통 장애점이 된다.
  대신 홈서버의 공인 웹 포트를 닫고 인증, DNS, 감사 경계를 한 곳에서 관리할 수 있다.

근거는 [Cloudflare full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/), [Tunnel 원본 매개변수](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/), [Access 애플리케이션 경로](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/), [GitHub webhook 검증](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) 문서다.
