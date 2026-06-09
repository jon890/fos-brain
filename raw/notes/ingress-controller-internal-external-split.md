---
source_type: session-notes
collected: 2026-06-09
topic: 외부/내부 ingress controller 분리 패턴
---

# 외부/내부 ingress controller 분리 패턴 — 세션 메모

(회사 무관 일반화 — 실무 작업에서 학습한 재사용 패턴)

## 핵심
- 한 클러스터에서 외부 공개 서비스와 내부 전용 서비스(배포 도구·관리자 콘솔 등)를 같은 ingress controller에 섞으면 위험: 그 controller를 공인 노출 시 내부 서비스까지 인터넷에 열리고, controller LB IP 재할당이 배포 도구(ArgoCD) 자신의 접근을 끊는 self-lock 유발 가능.
- 해결: 내부용 controller(사설 LB)와 외부용 controller(공인 LB)를 별도 인스턴스로 두고 IngressClass(예 nginx, nginx-external)로 분리. helm chart는 release name만 다르게 주면 controller-class·election-id·ClusterRole·webhook 이름을 자동 유일화.
- 함정: admission webhook(ValidatingWebhookConfiguration)은 cluster-scoped라 IngressClass·namespace로 격리되지 않고 클러스터 전체 ingress 변경을 가로챈다. 외부 controller webhook 추가 시 그게 죽으면(failurePolicy Fail) 내부 ingress 적용까지 막힘. 외부 controller는 admissionWebhooks 비활성 또는 objectSelector로 자기 것만 검증하게 제한.
- 클라우드 LoadBalancer 공인 IP는 미리 발급받는 게 아니라, LB 생성 시 자동 할당된 IP를 spec.loadBalancerIP에 고정하는 패턴이 일반적(annotation 방식은 벤더에 따라 동작 불안정).
- 공인 노출 초기 검증 단계에서 TLS 미적용 평문이면 whitelist-source-range로 사내 IP만 허용해 보호.
- 환경별 배포(GitOps)에서 특정 환경에만 컴포넌트를 켜려면 values 플래그 + ArgoCD Application의 stage 조건으로 게이팅(미설정 환경에 깨진 리소스가 퍼지는 것 방지).

## 연관
- k8s namespaced vs cluster-scoped 리소스 구분. IngressClass·ValidatingWebhookConfiguration이 cluster-scoped인 게 webhook 격리 안 되는 근본 이유.
