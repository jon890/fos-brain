# SSR 마크업 검사가 속성 출력 순서에 묶인다

## 증상

`data-testid="x"[^>]*type="button"` 같은 정규식은 두 속성이 그 순서로 나오기를 요구한다.
`preact-render-to-string` 은 JSX 의 prop 선언 순서대로 속성을 내므로,
JSX 에서 순서를 바꾸기만 해도 검사가 깨진다.
반대로 통과하더라도 렌더러의 출력 순서에 우연히 기댄 검사다.

## 실제 사례

`memoryAtlasView.test.tsx` 가 `data-testid` 뒤에 `type` 이 오기를 요구했는데,
`memoryAtlasView.tsx` 의 선언 순서는 `type` → `data-testid` → `class` → `aria-label` 이었다.

## 고치는 방법

태그 하나를 잘라 낸 뒤 속성을 각각 확인한다.
`memoryAtlasView.test.tsx` 의 `sliceTag` 와 `attributesOf` 가 그 형태다.
`sliceTag` 는 같은 이름의 태그가 안에 또 있는 경우를 위해 깊이를 센다.

## 검출

```bash
rg '\[\^>\]\*' --glob '*.test.tsx'
```
