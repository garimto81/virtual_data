# 액션 순서 관리자 V2 통합 가이드

## 개요
ActionOrderManagerV2는 핸드별로 고정된 절대 순위를 사용하여 액션 순서를 관리합니다.
플레이어가 폴드하거나 올인해도 순서가 꼬이지 않습니다.

## 주요 특징
1. **절대 순위 시스템**: 핸드 시작 시 순서 고정
2. **상태 독립적**: 플레이어 상태와 관계없이 일관된 순서
3. **핸드별 독립 처리**: 각 핸드마다 새로운 순서 계산
4. **자동 초기화**: 핸드 종료 시 자동 리셋

## 사용법

### 1. 스크립트 로드
```html
<!-- index.html의 <head> 부분에 추가 -->
<script src="src/js/action-order-manager-v2.js"></script>
```

### 2. 핸드 시작 시 초기화
```javascript
// 새 핸드 시작
function startNewHand() {
  const playersInHand = [
    {name: 'Player1', seat: 1, chips: 1000},
    {name: 'Player2', seat: 3, chips: 1500},
    {name: 'Player3', seat: 5, chips: 2000},
    {name: 'Player4', seat: 7, chips: 1200}
  ];

  const buttonPosition = 5; // seat 5가 버튼
  const handNumber = '123';

  // 액션 순서 초기화
  window.actionOrderManager.initializeHand(
    playersInHand,
    buttonPosition,
    handNumber
  );
}
```

### 3. 현재 액션 플레이어 확인
```javascript
// 현재 액션할 플레이어 가져오기
const currentPlayer = window.actionOrderManager.getCurrentPlayer('preflop');
if (currentPlayer) {
  console.log(`액션: ${currentPlayer.position}(${currentPlayer.player})`);
  // 예: "액션: UTG(Player1)"
}
```

### 4. 플레이어 액션 처리
```javascript
// 플레이어가 폴드한 경우
function handleFold(playerName) {
  window.actionOrderManager.updatePlayerStatus(playerName, 'folded');

  // 다음 플레이어로 이동
  const nextPlayer = window.actionOrderManager.moveToNextPlayer('preflop');
  if (nextPlayer) {
    openActionPad(nextPlayer.player);
  }
}

// 플레이어가 올인한 경우
function handleAllIn(playerName) {
  window.actionOrderManager.updatePlayerStatus(playerName, 'allin');

  // 다음 플레이어로 이동
  const nextPlayer = window.actionOrderManager.moveToNextPlayer('preflop');
  if (nextPlayer) {
    openActionPad(nextPlayer.player);
  }
}
```

### 5. 스트리트 전환
```javascript
// 플랍으로 전환
function moveToFlop() {
  const firstPlayer = window.actionOrderManager.advanceToStreet('flop');
  if (firstPlayer) {
    openActionPad(firstPlayer.player);
  }
}
```

### 6. 액션 순서 확인
```javascript
// 현재 스트리트의 액션 순서 보기
const order = window.actionOrderManager.getActionOrder('flop');
order.forEach(p => {
  console.log(`${p.position}(${p.player}): ${p.status}`);
});
// 출력 예:
// SB(Player1): folded
// BB(Player2): active
// UTG(Player3): active
// BTN(Player4): allin
```

### 7. 핸드 종료
```javascript
// 핸드 종료 시 자동 초기화
function endHand() {
  window.actionOrderManager.endHand();
  // 모든 순서 정보가 초기화됨
}
```

## 기존 코드 수정 지점

### 1. addActionToLog 함수 수정
```javascript
function addActionToLog(action, amount=null, player=null) {
  // ... 기존 코드 ...

  // 플레이어 상태 업데이트
  if (action === 'Folds') {
    window.actionOrderManager.updatePlayerStatus(playerName, 'folded');
  } else if (action === 'All In') {
    window.actionOrderManager.updatePlayerStatus(playerName, 'allin');
  }

  // ... 나머지 코드 ...
}
```

### 2. resetApp 함수 수정
```javascript
async function resetApp(reloadIndex = true, autoIncrement = false) {
  // ... 기존 초기화 코드 ...

  // 액션 순서 매니저 초기화
  window.actionOrderManager.endHand();

  // ... 나머지 코드 ...
}
```

### 3. loadHandData 함수 수정
```javascript
async function loadHandData(handNumber, preferDate) {
  // ... 데이터 로드 코드 ...

  // 액션 순서 초기화
  if (window.state.playersInHand.length > 0) {
    window.actionOrderManager.initializeHand(
      window.state.playersInHand,
      window.state.buttonPosition || 1,
      handNumber
    );
  }

  // ... 나머지 코드 ...
}
```

## 장점

1. **일관성**: 플레이어 상태와 무관하게 일정한 순서 유지
2. **예측 가능성**: 액션 순서를 미리 알 수 있음
3. **디버깅 용이**: debug() 함수로 현재 상태 확인 가능
4. **확장성**: 새로운 포지션이나 규칙 추가 용이

## 디버깅

```javascript
// 현재 상태 디버그 출력
window.actionOrderManager.debug();
```

출력 예시:
```
ActionOrderManagerV2 - 핸드 #123
현재 스트리트: flop
버튼 위치: 5
플레이어 상태:
  Player1: folded
  Player2: active
  Player3: active
  Player4: allin
프리플랍 순서:
  0. UTG(Player3) - active
  1. BTN(Player4) - allin
  2. SB(Player1) - folded
  3. BB(Player2) - active
포스트플랍 순서:
👉 0. SB(Player1) - folded
  1. BB(Player2) - active
  2. UTG(Player3) - active
  3. BTN(Player4) - allin
```

## 주의사항

1. **핸드 시작 시 반드시 initializeHand 호출**
2. **플레이어 상태 변경 시 updatePlayerStatus 사용**
3. **핸드 종료 시 endHand 호출로 메모리 정리**
4. **절대 순위는 핸드 중간에 변경 불가**

## 마이그레이션 체크리스트

- [ ] action-order-manager-v2.js 파일 추가
- [ ] index.html에 스크립트 로드
- [ ] startNewHand 함수에 초기화 코드 추가
- [ ] addActionToLog 함수 수정
- [ ] resetApp 함수에 endHand 추가
- [ ] loadHandData 함수 수정
- [ ] 테스트 실행

---
작성일: 2025-09-19
버전: 2.0.0