# erica-capstone-2026-backend


## [1] 개요
기존 ERICA 학생들의 파편화된 학사 정보, 비효율적 소통, 단절된 커뮤니티 문제를 해결합니다. 초기 유학생의 불편함이 모든 학생의 공통 문제임을 파악, 타겟을 전체 ERICA 학생으로 확장합니다.

**목표:** 직관적 개인화 학사 관리, AI 기반 정보 탐색, 목적 기반 커뮤니티를 하나의 플랫폼으로 제공하여 캠퍼스 생활의 질을 획기적으로 향상시킵니다.


## [2] 환경
### ▍스택 정의
- App Server
    - [Render.io](https://render.com/) - PaaS 호스팅
    - [UptimeRobot](https://uptimerobot.com/) - 24/7 모니터링
    - Express (nodejs)

### ▍핵심 아키텍쳐
- Backend Structure ![Backend Structure](./docs/res/backend_structure.svg)
- AI API Corresponding Sequence Diagram ![API Sequence Diagram](./docs/res/canvas-ai-api-corresponding-sequence-diagram.png)


### ▍환경변수 설정 (.env)
```bash

```

### ▍중요 파일 위치 (디렉토리 구조)
```
📁 .
├── 📁 dist
├── 📁 src
├── 📄 .env
├── 📄 .gitignore
├── 📄 package.json
├── 📄 README.md
└── 📄 tsconfig.json
```


## [3] 개발 전략
### ▍브랜치 구성
| **브랜치 이름** | **역할 및 정의** | **관리 규칙** |
| --- | --- | --- |
| production | 🚀 실제 서버 배포용 | main에서 검증된 코드만 이곳으로 Merge (Fast-forward 권장).PaaS는 이 브랜치만 바라봄. |
| main | 🛡️ 코드 저장소 & 통합 | 모든 기능(feature)이 합쳐지는 곳.develop역할을 겸함. Github 레포의 '간판'. |
| feature/* | ✨ 개별 기능 개발 | main에서 따서 개발 후main으로 PR. 케밥케이스 사용. (예시: feature/commit-me) |


## [4] 배포 및 유지 가이드
- Base URL: `https://erica-capstone-2026-backend.onrender.com`


## [5] 부록
