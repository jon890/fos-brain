---
type: concept
created: 2026-06-09
updated: 2026-06-09
---

# 외부/내부 ingress controller 분리 패턴

한 클러스터에서 외부 공개 서비스와 내부 전용 서비스(배포 도구·관리자 콘솔 등)를 같은 ingress controller에 섞으면, 그 controller를 공인으로 노출할 때 사고가 난다. 내부 서비스까지 인터넷에 열리고, controller LB의 IP가 재할당되며 배포 도구(ArgoCD 등) 자신의 접근이 끊기는 self-lock이 생긴다.

## 해결

내부용 controller(사설 LB)와 외부용 controller(공인 LB)를 **별도 인스턴스**로 두고 IngressClass(예: `nginx`, `nginx-external`)로 분리한다.

- helm chart는 release 이름만 다르게 주면 `controller-class`·`election-id`·ClusterRole·webhook 이름을 자동으로 유일하게 렌더한다.
- Ingress 리소스의 `ingressClassName`으로 어느 controller가 처리할지 가른다. 공개 대상만 외부 class로, 나머지는 내부 class로 둔다.

## 함정 — admission webhook은 cluster-scoped

ingress-nginx의 admission webhook(`ValidatingWebhookConfiguration`)은 cluster-scoped라, **IngressClass로도 namespace로도 격리되지 않고** 클러스터 전체의 ingress 변경을 가로챈다.

- 외부 controller를 추가하면 webhook이 하나 더 생기는데, 그게 죽으면(`failurePolicy: Fail`) **내부 ingress 적용까지 막힌다** — controller는 class로 갈라지지만 webhook은 안 갈라지기 때문.
- 대응: 외부 controller는 `admissionWebhooks`를 비활성하거나 `objectSelector`로 자기 것만 검증하게 제한한다. (전역 검증은 기존 controller의 webhook이 이미 하므로 trade-off가 작다.)

근본 원인은 IngressClass와 ValidatingWebhookConfiguration이 cluster-scoped 리소스라는 데 있다. namespaced 리소스(Pod·Service·Ingress)와 달리 namespace 경계로 막히지 않는다.

## 곁들이는 운영 팁

- **공인 IP 고정** — 클라우드 LoadBalancer의 공인 IP는 미리 발급받는 게 아니라, LB 생성 시 자동 할당된 IP를 `spec.loadBalancerIP`에 고정하는 패턴이 일반적이다. annotation 방식은 벤더에 따라 동작이 불안정할 수 있다.
- **테스트 단계 보호** — 공인 노출 초기에 TLS가 아직 없어 평문이라면, `whitelist-source-range`로 사내 IP만 허용해 검증한다.
- **환경별 게이팅** — GitOps에서 특정 환경에만 컴포넌트를 켜려면, values 플래그와 ArgoCD Application의 stage 조건으로 게이팅한다. 안 그러면 values가 없는 환경에 깨진 리소스가 퍼진다.

## 관련

- [[k8s-run-tmpfs-containerd]] — 같은 "운영·트러블슈팅 (실전)" 계열 k8s 함정

## Sources

- [[../raw/notes/ingress-controller-internal-external-split]]
