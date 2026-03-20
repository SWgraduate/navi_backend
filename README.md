# NAVI BACKEND

## 🚀 핵심 기술

* **백엔드**
    - [Express.js (Node.js)](https://nodejs.org/ko) - 메인 웹 서버 프레임워크
    - [TSOA](https://tsoa-community.github.io/docs/) - 타입 안정성 보장 및 OpenAPI(Swagger) 문서 자동화

* **데이터베이스**
    - [MongoDB (Atlas)](https://www.mongodb.com/) - 대학 생활 및 학사 정보 데이터를 유연하게 다루기 위한 NoSQL DB

* **AI & LLM 파이프라인**
    - [LangChain](https://www.langchain.com/) - 복잡한 LLM 워크플로우를 쉽게 구성하기 위한 프레임워크
    - [OpenRouter](https://openrouter.ai/) - 다양한 LLM 모델을 일관된 환경에서 호출하기 위한 통합 API 라우터

* **인프라 및 데브옵스 (Infrastructure & DevOps)**
    - [Render.io](https://render.com/) - 백엔드 서버 PaaS 호스팅
    - [UptimeRobot](https://uptimerobot.com/) - 24/7 서버 가동 상태 모니터링

## 🧩 아키텍쳐
* **Backend Structure**
![Backend Structure](./docs/res/backend_structure.svg)
* **API Corresponding Sequence Diagram**
![API Sequence Diagram](./docs/res/canvas-ai-api-corresponding-sequence-diagram.png)

## 📦 환경 세팅

### 패키지 구동 및 의존성 설치
본 프로젝트는 패키지 매니저로 `pnpm`을 사용합니다. 처음 시작하실 때 아래 명령어를 실행하여 pnpm을 전역으로 설치한 뒤 의존성 패키지를 설치해 주세요.

```bash
npm install -g pnpm
pnpm install
```

### 환경변수 설정 (.env)
```bash
APP_PORT=8000
NODE_ENV=development
JWT_SECRET=""
MONGO_URI=""
OPENROUTER_API_KEY=""
RESEND_KEY=""
PINECONE_API_KEY=""
DISCORD_WEBHOOK_URL=""
```
```
📁 .
├── 📁 dist
├── 📁 src
├── 📄 .env
└── 📄 README.md
```

### 테스트
> [!NOTE]  
> 단위 테스트; 파일 상단에 실행 명령어를 기재함.

> [!TIP]
> 일부 테스트는 MongoDB 설치가 필요합니다.

```bash
pnpm test
```

## [3] 개발 전략

### 브랜치 구성
> [!IMPORTANT]
> `main` 브랜치를 직접 push 할 수 없습니다.
 
| 브랜치 이름 | 역할 및 정의 | 관리 규칙 |
| --- | --- | --- |
| `production` | 실제 서버 배포용 | `main`에서 검증된 릴리즈 버전을 반영. |
| `main` | 정식 릴리즈 및 배포 기준 | 병합 시 GitHub Actions로 자동 버전 태그 및 릴리즈 생성. (PR 병합 필수) |
| `develop` | 코드 통합 및 테스트 | `feature` 브랜치들이 모이는 개발 메인. (PR 병합 필수) |
| `feature/*` | 개별 기능 개발 | `develop`에서 분기 후 개발, 완료 시 `develop`으로 PR. |
| `hotfix/*` | 운영 환경 긴급 수정 | `main`에서 직접 분기 후 수정, `main`과 `develop`에 각각 PR. |

## [4] 배포 및 유지 가이드

`production` 브랜치의 커밋이 바뀌면 자동으로 배포됨.
- Base URL: `https://erica-capstone-2026-backend.onrender.com`
- Swagger Spec: https://erica-capstone-2026-backend.onrender.com/api-docs

## [5] 부록
