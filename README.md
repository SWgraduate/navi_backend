# NAVI BACKEND

## 🚀 핵심 기술

### ▍백엔드
- [Express.js (Node.js)](https://nodejs.org/ko) - 메인 웹 서버 프레임워크
- [TSOA](https://tsoa-community.github.io/docs/) - 타입 안정성 보장 및 OpenAPI(Swagger) 문서 자동화

### ▍데이터베이스
- [MongoDB (Atlas)](https://www.mongodb.com/) - 대학 생활 및 학사 정보 데이터를 유연하게 다루기 위한 NoSQL DB

### ▍AI & LLM 파이프라인
- [LangChain](https://www.langchain.com/) - 복잡한 LLM 워크플로우를 쉽게 구성하기 위한 프레임워크
- [OpenRouter](https://openrouter.ai/) - 다양한 LLM 모델을 일관된 환경에서 호출하기 위한 통합 API 라우터

### ▍인프라 및 데브옵스 (Infrastructure & DevOps)
- [Render.io](https://render.com/) - 백엔드 서버 PaaS 호스팅
- [UptimeRobot](https://uptimerobot.com/) - 24/7 서버 가동 상태 모니터링

## 🧩 아키텍쳐
### Backend Structure
![Backend Structure](./docs/res/backend_structure.svg)
### AI API Corresponding Sequence Diagram
![API Sequence Diagram](./docs/res/canvas-ai-api-corresponding-sequence-diagram.png)

## 📦 환경 세팅

### ▍환경변수 설정 (.env / .env.test)
```bash
LLM_TOKEN=""
MONGO_URI=""
```
```
📁 .
├── 📁 dist
├── 📁 src
├── 📄 .env
├── 📄 .env.test
└── 📄 README.md
```

### ▍테스트
```bash
pnpm test
```

> [!NOTE]  
> 단위 테스트; 파일 상단에 실행 명령어를 기재함.

> [!TIP]
> 일부 테스트는 MongoDB 설치가 필요합니다.

## [3] 개발 전략

### ▍브랜치 구성
| 브랜치 이름 | 역할 및 정의       | 관리 규칙 |
| ---         | ---                | --- |
| production  | 실제 서버 배포용   | main에서 검증된 코드만 이곳으로 Merge (Fast-forward 권장). |
| main        | 코드 저장소 & 통합 | 모든 기능(feature)이 합쳐지는 곳. develop역할을 겸함. |
| feature/*   | 개별 기능 개발     | main에서 따서 개발 후 main으로 PR. (예시: feature/commit-me) |

> [!IMPORTANT]
> `main` 브랜치를 직접 push 할 수 없습니다.

## [4] 배포 및 유지 가이드
`production` 브랜치의 커밋이 바뀌면 자동으로 배포됨.
- Base URL: `https://erica-capstone-2026-backend.onrender.com`
- Swagger Spec: https://erica-capstone-2026-backend.onrender.com/api-docs

> [!CAUTION]
> base url 접근 제한 아직 없어서 노출되지 않도록 주의해야 함 (26. 3. 5.)

## [5] 부록
