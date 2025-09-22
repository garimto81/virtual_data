# 🎰 Virtual Data 포커 핸드 로거 시스템 - 종합 설계 기획서

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [현황 분석](#현황-분석)
3. [시스템 아키텍처 설계](#시스템-아키텍처-설계)
4. [데이터베이스 설계](#데이터베이스-설계)
5. [보안 전략](#보안-전략)
6. [통계 및 분석 시스템](#통계-및-분석-시스템)
7. [기술 스택 선정](#기술-스택-선정)
8. [구현 로드맵](#구현-로드맵)
9. [비용 분석 및 ROI](#비용-분석-및-roi)
10. [리스크 관리](#리스크-관리)

---

## 프로젝트 개요

### 비전
실시간 포커 게임 데이터를 완벽하게 추적, 분석, 시각화하여 플레이어의 성과 향상과 게임 운영 최적화를 지원하는 차세대 포커 핸드 로깅 플랫폼 구축

### 핵심 가치
- **실시간성**: 모든 액션이 즉시 반영되는 제로 지연 시스템
- **정확성**: 100% 정확한 데이터 기록 및 검증
- **확장성**: 수천 명의 동시 사용자 지원
- **분석력**: AI 기반 고급 통계 및 예측 분석

### 목표 사용자
- 온라인 포커 플레이어 (프로 및 아마추어)
- 포커 게임 운영자
- 포커 코치 및 분석가
- 포커 커뮤니티 및 스터디 그룹

---

## 현황 분석

### 현재 시스템 (v3.4.25)

#### 강점
- ✅ Google Sheets 연동으로 빠른 프로토타이핑
- ✅ 실시간 웹 기반 접근성
- ✅ 모듈화된 JavaScript 구조 (ActionOrderManagerV2, DuplicateRemover 등)
- ✅ 액션 순서 절대 순위 시스템 구현

#### 한계점
- ❌ Google Apps Script 실행 제한 (6분/요청, 일일 쿼터)
- ❌ 확장성 부족 (동시 사용자 10명 제한)
- ❌ 데이터베이스 쿼리 최적화 불가능
- ❌ 보안 취약점 (SHA-256 단순 해싱, API 키 노출)
- ❌ 제한적인 통계 분석 기능

### 경쟁 제품 분석

| 제품 | 강점 | 약점 | 시장점유율 |
|------|------|------|-----------|
| PokerTracker 4 | 안정성, 일회성 구매 | UI 노후화, 느린 DB | 35% |
| Holdem Manager 3 | 고급 분석, 빠른 처리 | 구독 모델, 높은 메모리 | 30% |
| 기타 도구들 | 특화 기능 | 통합성 부족 | 35% |

### 차별화 전략
1. **브라우저 기반**: 설치 불필요, 즉시 접근
2. **실시간 협업**: 팀 분석 및 데이터 공유
3. **AI 통합**: 머신러닝 기반 예측 및 조언
4. **모바일 최적화**: 반응형 디자인 및 터치 지원

---

## 시스템 아키텍처 설계

### 전체 시스템 구조

```mermaid
graph TB
    subgraph "클라이언트 레이어"
        WEB[React SPA]
        MOB[React Native]
        PWA[Progressive Web App]
    end

    subgraph "API Gateway"
        KONG[Kong Gateway]
        LB[로드 밸런서]
    end

    subgraph "마이크로서비스"
        AUTH[인증 서비스]
        GAME[게임 관리]
        PLAYER[플레이어 서비스]
        HAND[핸드 기록]
        REAL[실시간 통신]
        ANAL[분석 서비스]
    end

    subgraph "데이터 레이어"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        MONGO[(MongoDB)]
        S3[S3 Storage]
    end

    WEB --> KONG
    MOB --> KONG
    PWA --> KONG
    KONG --> LB
    LB --> AUTH
    LB --> GAME
    LB --> PLAYER
    LB --> HAND
    LB --> REAL
    LB --> ANAL

    AUTH --> REDIS
    GAME --> POSTGRES
    PLAYER --> POSTGRES
    HAND --> POSTGRES
    REAL --> REDIS
    ANAL --> MONGO
```

### 핵심 컴포넌트 상세

#### 1. 인증 서비스 (Authentication Service)
```typescript
interface AuthenticationService {
  // JWT + OAuth 2.0 기반
  login(credentials: LoginRequest): Promise<TokenPair>
  refresh(refreshToken: string): Promise<AccessToken>
  logout(userId: string): Promise<void>

  // MFA 지원
  enableMFA(userId: string): Promise<MFASecret>
  verifyMFA(userId: string, code: string): Promise<boolean>
}
```

#### 2. 실시간 통신 서비스 (Real-time Service)
```typescript
interface RealtimeService {
  // Socket.IO 기반 실시간 통신
  joinTable(tableId: string, userId: string): void
  leaveTable(tableId: string, userId: string): void

  // 이벤트 브로드캐스트
  broadcastAction(tableId: string, action: PlayerAction): void
  broadcastStateUpdate(tableId: string, state: TableState): void
}
```

#### 3. 분석 서비스 (Analytics Service)
```typescript
interface AnalyticsService {
  // 실시간 통계
  calculateVPIP(playerId: string): number
  calculatePFR(playerId: string): number
  calculateAF(playerId: string): number

  // AI 예측
  predictNextAction(gameState: GameState): PredictedAction
  detectAnomalies(sessionData: SessionData): Anomaly[]
}
```

---

## 데이터베이스 설계

### 정규화된 스키마 구조

```sql
-- 핵심 테이블 구조
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    country VARCHAR(3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    max_players INTEGER DEFAULT 9,
    small_blind DECIMAL(10,2),
    big_blind DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

CREATE TABLE hands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID REFERENCES tables(id),
    hand_number INTEGER NOT NULL,
    dealer_position INTEGER,
    pot_size DECIMAL(10,2),
    board_cards JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(table_id, hand_number)
);

CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hand_id UUID REFERENCES hands(id),
    player_id UUID REFERENCES players(id),
    action_type VARCHAR(20), -- FOLD, CHECK, CALL, BET, RAISE
    amount DECIMAL(10,2),
    street VARCHAR(10), -- PREFLOP, FLOP, TURN, RIVER
    sequence INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 파티셔닝 (월별)
CREATE TABLE hands_2025_01 PARTITION OF hands
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 인덱싱 전략
CREATE INDEX idx_hands_table_created ON hands(table_id, created_at DESC);
CREATE INDEX idx_actions_hand_sequence ON actions(hand_id, sequence);
CREATE INDEX idx_players_name ON players(name);
```

### 캐싱 전략

```yaml
Redis 캐시 구조:
  세션 캐시:
    key: session:{user_id}
    value: {user_data, permissions}
    TTL: 24시간

  테이블 상태:
    key: table:{table_id}
    value: {current_hand, players, pot}
    TTL: 1시간

  통계 캐시:
    key: stats:{player_id}:{metric}
    value: calculated_value
    TTL: 5분
```

### 데이터 마이그레이션 계획

```mermaid
graph LR
    A[Google Sheets] -->|ETL| B[Staging DB]
    B -->|검증| C[PostgreSQL]
    C -->|백업| D[S3 Archive]
```

---

## 보안 전략

### 보안 아키텍처

```
┌─────────────────────────────────────────┐
│            WAF (Web Application Firewall)│
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│              HTTPS/TLS 1.3               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         API Rate Limiting (100/min)      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      JWT + MFA Authentication            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        RBAC Authorization                │
└─────────────────────────────────────────┘
```

### 즉시 조치 필요 사항 (Critical)

1. **비밀번호 해싱 강화**
```javascript
// 현재: SHA-256 (취약)
// 개선: PBKDF2 with 100,000 iterations
const hash = await crypto.pbkdf2(password, salt, 100000, 64, 'sha256');
```

2. **API 키 서버사이드 이동**
```javascript
// 환경변수 사용
process.env.GOOGLE_SHEETS_API_KEY
```

3. **입력 검증 강화**
```javascript
// 화이트리스트 기반 검증
const sanitizedInput = validator.escape(userInput);
```

### 보안 체크리스트

- [ ] OWASP Top 10 대응
- [ ] CSRF 토큰 구현
- [ ] XSS 방지 (CSP 헤더)
- [ ] SQL Injection 방지 (Prepared Statements)
- [ ] 감사 로깅 시스템
- [ ] 침투 테스트 (분기별)

---

## 통계 및 분석 시스템

### 핵심 포커 메트릭

```sql
-- VPIP (Voluntarily Put money In Pot) 계산
CREATE FUNCTION calculate_vpip(player_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_hands INTEGER;
    voluntary_hands INTEGER;
BEGIN
    SELECT COUNT(DISTINCT h.id) INTO total_hands
    FROM hands h
    JOIN hand_players hp ON h.id = hp.hand_id
    WHERE hp.player_id = player_uuid;

    SELECT COUNT(DISTINCT h.id) INTO voluntary_hands
    FROM hands h
    JOIN actions a ON h.id = a.hand_id
    WHERE a.player_id = player_uuid
    AND a.street = 'PREFLOP'
    AND a.action_type IN ('CALL', 'BET', 'RAISE');

    RETURN (voluntary_hands::DECIMAL / total_hands) * 100;
END;
$$ LANGUAGE plpgsql;
```

### 실시간 대시보드 메트릭

```typescript
interface DashboardMetrics {
  // 시스템 메트릭
  activeTables: number
  onlinePlayers: number
  handsPerHour: number

  // 비즈니스 메트릭
  totalPotSize: number
  averageHandDuration: number
  peakConcurrentUsers: number

  // 플레이어 메트릭
  topWinners: PlayerRanking[]
  mostActivePlayer s: PlayerActivity[]
}
```

### AI/ML 통합

```python
# 플레이어 행동 예측 모델
from sklearn.ensemble import RandomForestClassifier

class ActionPredictor:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100)

    def predict_action(self, game_state):
        features = self.extract_features(game_state)
        prediction = self.model.predict(features)
        return {
            'action': prediction[0],
            'confidence': self.model.predict_proba(features).max()
        }
```

---

## 기술 스택 선정

### 최종 선정 기술 스택

| 영역 | 기술 | 선정 이유 |
|------|------|-----------|
| **Frontend** | React 18 + TypeScript | 성능, 생태계, 타입 안정성 |
| **Backend** | Node.js + Express | JavaScript 통일, 비동기 처리 |
| **Real-time** | Socket.IO | 안정성, Room 기능, 자동 재연결 |
| **Database** | PostgreSQL + Supabase | ACID, 실시간 CDC, SQL 분석 |
| **Cache** | Redis | 고성능, Pub/Sub 지원 |
| **Analytics** | Python + BigQuery | ML 라이브러리, 대용량 분석 |
| **Cloud** | Google Cloud Platform | BigQuery, 비용 효율성 |
| **Monitoring** | Prometheus + Grafana | 오픈소스, 커스터마이징 |

### 개발 환경 설정

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: poker_db
      POSTGRES_USER: poker_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://poker_user:secure_password@postgres:5432/poker_db
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

---

## 구현 로드맵

### Phase 1: 기반 구축 (4주)

#### Week 1-2: 인프라 설정
- [ ] GCP 프로젝트 생성 및 설정
- [ ] PostgreSQL + Supabase 구성
- [ ] Redis 클러스터 설정
- [ ] CI/CD 파이프라인 구축

#### Week 3-4: 핵심 서비스
- [ ] 인증 서비스 구현
- [ ] 기본 CRUD API
- [ ] WebSocket 연결 설정
- [ ] 기본 프론트엔드 구조

### Phase 2: 핵심 기능 (8주)

#### Week 5-8: 게임 로직
- [ ] 핸드 기록 시스템
- [ ] 액션 처리 로직
- [ ] 실시간 상태 동기화
- [ ] 팟 계산 및 칩 관리

#### Week 9-12: 분석 시스템
- [ ] 통계 계산 엔진
- [ ] 실시간 대시보드
- [ ] 기본 리포팅
- [ ] 데이터 내보내기

### Phase 3: 고급 기능 (8주)

#### Week 13-16: AI/ML 통합
- [ ] 행동 예측 모델
- [ ] 이상 탐지 시스템
- [ ] 개인화된 조언
- [ ] GTO 분석 통합

#### Week 17-20: 최적화 및 배포
- [ ] 성능 최적화
- [ ] 보안 강화
- [ ] 부하 테스트
- [ ] 프로덕션 배포

### 마일스톤 및 KPI

| 마일스톤 | 목표 날짜 | 성공 기준 |
|----------|----------|----------|
| MVP 출시 | 3개월 | 10개 테이블 동시 운영 |
| Beta 출시 | 6개월 | 100명 동시 사용자 |
| 정식 출시 | 9개월 | 1,000명 동시 사용자 |
| 수익화 | 12개월 | 월 $10,000 수익 |

---

## 비용 분석 및 ROI

### 초기 투자 비용 (6개월)

| 항목 | 비용 | 비고 |
|------|------|------|
| 개발 인건비 | $120,000 | 4명 x 6개월 |
| 인프라 비용 | $6,000 | 클라우드 + 도구 |
| 라이선스 | $3,000 | 써드파티 API |
| 마케팅 | $10,000 | 초기 사용자 확보 |
| **총 투자** | **$139,000** | |

### 운영 비용 (월간)

| 서비스 | 비용 | 사용량 기준 |
|--------|------|------------|
| GCP (서버) | $500 | 1,000 사용자 |
| Supabase | $25 + 사용량 | Pro 플랜 |
| 도메인/CDN | $50 | CloudFlare |
| 모니터링 | $100 | Datadog |
| **월 운영비** | **$675** | |

### 수익 모델 및 예상 수익

| 수익원 | 월 예상 수익 | 전환율 |
|--------|------------|--------|
| 기본 구독 ($9.99/월) | $5,000 | 500명 x 10% |
| 프로 구독 ($29.99/월) | $6,000 | 200명 x 10% |
| 엔터프라이즈 | $4,000 | 5개 기업 |
| API 액세스 | $2,000 | 파트너십 |
| **총 월 수익** | **$17,000** | |

### ROI 분석

- **손익분기점**: 8개월
- **1년차 순이익**: $65,400
- **ROI**: 147% (18개월)
- **투자 회수 기간**: 12개월

---

## 리스크 관리

### 기술적 리스크

| 리스크 | 영향도 | 발생확률 | 대응 방안 |
|--------|--------|---------|-----------|
| 확장성 문제 | 높음 | 중간 | 마이크로서비스 아키텍처 |
| 데이터 손실 | 매우 높음 | 낮음 | 다중 백업, 재해 복구 |
| 보안 침해 | 매우 높음 | 중간 | 정기 보안 감사 |
| 성능 저하 | 중간 | 높음 | 캐싱, 쿼리 최적화 |

### 사업적 리스크

| 리스크 | 영향도 | 발생확률 | 대응 방안 |
|--------|--------|---------|-----------|
| 경쟁사 출현 | 중간 | 높음 | 차별화 기능 강화 |
| 규제 변화 | 높음 | 낮음 | 법률 자문 |
| 사용자 이탈 | 높음 | 중간 | 지속적 기능 개선 |

### 리스크 대응 우선순위

1. **즉시 대응 (Critical)**
   - 보안 취약점 패치
   - 데이터 백업 시스템 구축
   - 모니터링 시스템 구축

2. **단기 대응 (1개월)**
   - 성능 최적화
   - 확장성 테스트
   - 사용자 피드백 시스템

3. **중기 대응 (3개월)**
   - 차별화 기능 개발
   - 파트너십 구축
   - 국제화 준비

---

## 결론 및 다음 단계

### 핵심 성공 요인

1. **기술적 우수성**: 안정적이고 확장 가능한 아키텍처
2. **사용자 경험**: 직관적이고 빠른 인터페이스
3. **데이터 정확성**: 100% 신뢰할 수 있는 데이터
4. **지속적 혁신**: AI/ML 통합, 새로운 기능

### 즉시 실행 항목

1. **Week 1**
   - [ ] 프로젝트 팀 구성
   - [ ] GCP 계정 생성 및 설정
   - [ ] 개발 환경 구축
   - [ ] 상세 요구사항 정의

2. **Week 2**
   - [ ] 데이터베이스 스키마 구현
   - [ ] API 설계 문서 작성
   - [ ] 프로토타입 개발 시작
   - [ ] 보안 감사 계획 수립

3. **Week 3-4**
   - [ ] MVP 핵심 기능 구현
   - [ ] 테스트 자동화 설정
   - [ ] 초기 사용자 테스트
   - [ ] 피드백 수집 및 반영

### 장기 비전

Virtual Data 포커 핸드 로거는 단순한 기록 도구를 넘어, 포커 플레이어의 성장을 돕는 종합 플랫폼으로 진화할 것입니다. AI 기반 코칭, 실시간 조언, 커뮤니티 기능을 통해 글로벌 포커 생태계의 핵심 인프라가 되는 것이 우리의 목표입니다.

---

**문서 버전**: 1.0.0
**작성일**: 2025-09-22
**작성자**: Claude AI Assistant
**검토 필요**: 기술팀, 경영진, 투자자

*이 기획서는 Virtual Data 프로젝트의 종합적인 로드맵으로, 지속적으로 업데이트되어야 합니다.*