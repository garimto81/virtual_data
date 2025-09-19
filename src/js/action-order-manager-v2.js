/**
 * 액션 순서 관리자 v2 - 절대 순위 시스템
 * 핸드별로 고정된 액션 순서를 유지하여 플레이어 상태 변경에도 순서가 보장됨
 * @version 2.0.0
 * @date 2025-09-19
 */

class ActionOrderManagerV2 {
    constructor() {
        // 현재 핸드 정보
        this.handNumber = null;
        this.buttonPosition = 1;

        // 절대 순위 테이블 (핸드 시작 시 고정)
        this.absoluteOrder = {
            preflop: [],  // [{player, seat, position, priority}, ...]
            postflop: []  // 플랍/턴/리버 공통
        };

        // 현재 진행 상태
        this.currentStreet = 'preflop';
        this.currentActionIndex = {
            preflop: 0,
            flop: 0,
            turn: 0,
            river: 0
        };

        // 플레이어 상태 (액션 가능 여부)
        this.playerStatus = {}; // {playerName: 'active'|'folded'|'allin'}

        console.log('ActionOrderManagerV2 초기화 완료');
    }

    /**
     * 새 핸드 시작 - 절대 순위 테이블 생성
     * @param {Array} playersInHand - 핸드 참여 플레이어 목록
     * @param {Number} buttonPosition - 버튼 위치 (선택사항)
     * @param {String} handNumber - 핸드 번호
     */
    initializeHand(playersInHand, buttonPosition, handNumber) {
        console.log(`=== 핸드 #${handNumber} 절대 순위 초기화 ===`);
        console.log('초기화 파라미터:', {
            playersCount: playersInHand.length,
            players: playersInHand.map(p => `${p.name}(seat:${p.seat})`),
            buttonPosition,
            handNumber
        });

        this.handNumber = handNumber;
        this.buttonPosition = buttonPosition;

        // 플레이어 상태 초기화
        this.playerStatus = {};
        playersInHand.forEach(p => {
            this.playerStatus[p.name] = 'active';
        });

        // 액션 인덱스 초기화
        this.currentActionIndex = {
            preflop: 0,
            flop: 0,
            turn: 0,
            river: 0
        };

        // 버튼 위치 검증 및 순서 생성 방식 결정
        const hasValidButtonPosition = this.validateButtonPosition(playersInHand, buttonPosition);

        if (hasValidButtonPosition) {
            console.log('✅ 버튼 위치 기반 포지션 순서 생성');
            // 절대 순위 테이블 생성 (포지션 기반)
            this.absoluteOrder = {
                preflop: this.createPreflopOrder(playersInHand, buttonPosition),
                postflop: this.createPostflopOrder(playersInHand, buttonPosition)
            };
        } else {
            console.log('⚡ 선택 순서 기반 절대 위치 생성');
            // 절대 순위 테이블 생성 (선택 순서 기반)
            this.absoluteOrder = {
                preflop: this.createSequentialOrder(playersInHand, 'preflop'),
                postflop: this.createSequentialOrder(playersInHand, 'postflop')
            };
        }

        console.log('프리플랍 순서:', this.absoluteOrder.preflop.map(p =>
            `${p.position}(${p.player})`).join(' → '));
        console.log('포스트플랍 순서:', this.absoluteOrder.postflop.map(p =>
            `${p.position}(${p.player})`).join(' → '));

        return this;
    }

    /**
     * 버튼 위치 유효성 검증
     * @param {Array} players - 플레이어 목록
     * @param {Number} buttonPosition - 버튼 위치
     */
    validateButtonPosition(players, buttonPosition) {
        if (!buttonPosition || !players.length) {
            return false;
        }

        // 플레이어들의 실제 시트 번호 수집 (문자열/숫자 혼용 대응)
        const playerSeats = players
            .map(p => parseInt(p.seat))
            .filter(seat => !isNaN(seat));

        const buttonSeat = parseInt(buttonPosition);
        const hasValidButton = playerSeats.includes(buttonSeat);

        console.log('버튼 위치 검증:', {
            buttonPosition: buttonSeat,
            playerSeats,
            isValid: hasValidButton
        });

        return hasValidButton;
    }

    /**
     * 선택 순서 기반 절대 위치 생성
     * @param {Array} players - 플레이어 목록
     * @param {String} type - 'preflop' 또는 'postflop'
     */
    createSequentialOrder(players, type) {
        const order = [];

        if (type === 'preflop') {
            // 프리플랍: 첫 번째 선택된 플레이어부터 UTG 순서로 액션
            players.forEach((player, index) => {
                const position = this.getSequentialPreflopPosition(index, players.length);
                order.push({
                    player: player.name,
                    seat: player.seat,
                    position: position,
                    priority: index
                });
            });
        } else {
            // 포스트플랍: 첫 번째 선택된 플레이어부터 액션 (SB 순서)
            players.forEach((player, index) => {
                const position = this.getSequentialPostflopPosition(index, players.length);
                order.push({
                    player: player.name,
                    seat: player.seat,
                    position: position,
                    priority: index
                });
            });
        }

        console.log(`${type} 선택 순서 기반 생성:`, order);
        return order;
    }

    /**
     * 순차 프리플랍 포지션 할당
     */
    getSequentialPreflopPosition(index, totalPlayers) {
        if (totalPlayers === 2) {
            return index === 0 ? 'SB/BTN' : 'BB';
        }
        if (totalPlayers === 3) {
            return ['BTN', 'SB', 'BB'][index] || `P${index + 1}`;
        }
        if (totalPlayers === 4) {
            return ['BTN', 'SB', 'BB', 'UTG'][index] || `P${index + 1}`;
        }
        if (totalPlayers === 5) {
            return ['BTN', 'SB', 'BB', 'UTG', 'CO'][index] || `P${index + 1}`;
        }
        if (totalPlayers >= 6) {
            return ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'CO'][index] || `P${index + 1}`;
        }
        return `P${index + 1}`;
    }

    /**
     * 순차 포스트플랍 포지션 할당
     */
    getSequentialPostflopPosition(index, totalPlayers) {
        if (totalPlayers === 2) {
            return index === 0 ? 'SB/BTN' : 'BB';
        }
        // 포스트플랍은 SB부터 시작하므로 순서 조정
        if (totalPlayers === 3) {
            return ['SB', 'BB', 'BTN'][index] || `P${index + 1}`;
        }
        if (totalPlayers === 4) {
            return ['SB', 'BB', 'UTG', 'BTN'][index] || `P${index + 1}`;
        }
        if (totalPlayers === 5) {
            return ['SB', 'BB', 'UTG', 'CO', 'BTN'][index] || `P${index + 1}`;
        }
        if (totalPlayers >= 6) {
            return ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'CO', 'BTN'][index] || `P${index + 1}`;
        }
        return `P${index + 1}`;
    }

    /**
     * 프리플랍 절대 순위 생성 (포지션 기반)
     */
    createPreflopOrder(players, buttonPosition) {
        const order = [];
        const seatMap = new Map();

        // 시트 번호를 숫자로 정규화하여 저장
        players.forEach(p => {
            const normalizedSeat = parseInt(p.seat);
            if (!isNaN(normalizedSeat)) {
                seatMap.set(normalizedSeat, p);
            }
        });

        const occupiedSeats = Array.from(seatMap.keys()).sort((a, b) => a - b);
        const totalPlayers = occupiedSeats.length;
        const normalizedButtonPosition = parseInt(buttonPosition);

        console.log('프리플랍 순서 생성:', {
            occupiedSeats,
            buttonPosition: normalizedButtonPosition,
            totalPlayers
        });

        // 버튼 위치 찾기
        const btnIndex = occupiedSeats.indexOf(normalizedButtonPosition);
        if (btnIndex === -1) {
            console.error('프리플랍: 버튼 위치를 찾을 수 없음', {
                buttonPosition: normalizedButtonPosition,
                occupiedSeats
            });
            return order;
        }

        // 포지션 할당 (시계방향)
        const positions = [];
        for (let i = 0; i < totalPlayers; i++) {
            const seatIndex = (btnIndex + i + 1) % totalPlayers;
            const seat = occupiedSeats[seatIndex];
            const player = seatMap.get(seat);

            let position;
            if (i === 0) position = 'SB';
            else if (i === 1) position = 'BB';
            else if (i === totalPlayers - 1) position = 'BTN';
            else if (i === 2) position = 'UTG';
            else if (i === 3) position = 'UTG+1';
            else if (i === 4) position = 'MP1';
            else if (i === 5) position = 'MP2';
            else if (i === totalPlayers - 2) position = 'CO';
            else position = `MP${i-2}`;

            positions.push({ player, seat, position, index: i });
        }

        // 플레이어 수별 순서 처리
        if (totalPlayers === 1) {
            // 1명: 혼자이므로 BTN/SB/BB 역할을 모두 담당
            order.push({
                player: positions[0].player.name,
                seat: positions[0].seat,
                position: 'BTN/SB/BB',
                priority: order.length
            });
        } else if (totalPlayers === 2) {
            // 2명: SB가 버튼, BB 순서
            order.push({
                player: positions[0].player.name, // SB (버튼)
                seat: positions[0].seat,
                position: 'SB/BTN',
                priority: order.length
            });
            order.push({
                player: positions[1].player.name, // BB
                seat: positions[1].seat,
                position: 'BB',
                priority: order.length
            });
        } else {
            // 3명 이상: 프리플랍 액션 순서: UTG → BTN → SB → BB
            // UTG부터 시작
            for (let i = 2; i < totalPlayers; i++) {
                order.push({
                    player: positions[i].player.name,
                    seat: positions[i].seat,
                    position: positions[i].position,
                    priority: order.length
                });
            }

            // SB, BB 마지막에 추가
            order.push({
                player: positions[0].player.name,
                seat: positions[0].seat,
                position: 'SB',
                priority: order.length
            });

            order.push({
                player: positions[1].player.name,
                seat: positions[1].seat,
                position: 'BB',
                priority: order.length
            });
        }

        return order;
    }

    /**
     * 포스트플랍 절대 순위 생성
     */
    createPostflopOrder(players, buttonPosition) {
        const order = [];
        const seatMap = new Map();

        // 시트 번호를 숫자로 정규화하여 저장
        players.forEach(p => {
            const normalizedSeat = parseInt(p.seat);
            if (!isNaN(normalizedSeat)) {
                seatMap.set(normalizedSeat, p);
            }
        });

        const occupiedSeats = Array.from(seatMap.keys()).sort((a, b) => a - b);
        const totalPlayers = occupiedSeats.length;
        const normalizedButtonPosition = parseInt(buttonPosition);

        console.log('포스트플랍 순서 생성:', {
            occupiedSeats,
            buttonPosition: normalizedButtonPosition,
            totalPlayers
        });

        // 버튼 위치 찾기
        const btnIndex = occupiedSeats.indexOf(normalizedButtonPosition);
        if (btnIndex === -1) {
            console.error('포스트플랍: 버튼 위치를 찾을 수 없음', {
                buttonPosition: normalizedButtonPosition,
                occupiedSeats
            });
            return order;
        }

        // 플레이어 수별 포스트플랍 순서 처리
        if (totalPlayers === 1) {
            // 1명: 혼자이므로 모든 역할
            const seatIndex = btnIndex;
            const seat = occupiedSeats[seatIndex];
            const player = seatMap.get(seat);

            order.push({
                player: player.name,
                seat: seat,
                position: 'BTN/SB/BB',
                priority: 0
            });
        } else {
            // 2명 이상: 포스트플랍 액션 순서: SB → BB → UTG → ... → BTN
            for (let i = 0; i < totalPlayers; i++) {
                const seatIndex = (btnIndex + i + 1) % totalPlayers;
                const seat = occupiedSeats[seatIndex];
                const player = seatMap.get(seat);

                let position;
                if (totalPlayers === 2) {
                    // 2명: SB(BTN) → BB 순서
                    if (i === 0) position = 'SB/BTN';
                    else position = 'BB';
                } else {
                    // 3명 이상
                    if (i === 0) position = 'SB';
                    else if (i === 1) position = 'BB';
                    else if (i === totalPlayers - 1) position = 'BTN';
                    else if (i === 2) position = 'UTG';
                    else if (i === 3) position = 'UTG+1';
                    else if (i === 4) position = 'MP1';
                    else if (i === 5) position = 'MP2';
                    else if (i === totalPlayers - 2) position = 'CO';
                    else position = `MP${i-2}`;
                }

                order.push({
                    player: player.name,
                    seat: seat,
                    position: position,
                    priority: i
                });
            }
        }

        return order;
    }

    /**
     * 현재 액션할 플레이어 가져오기
     * @param {String} street - 현재 스트리트
     */
    getCurrentPlayer(street) {
        // 스트리트 정규화: flop/turn/river는 모두 postflop 순서 사용
        const normalizedStreet = street === 'preflop' ? 'preflop' : 'postflop';
        const orderTable = this.absoluteOrder[normalizedStreet];

        if (!orderTable || orderTable.length === 0) {
            console.error(`ActionOrderManagerV2: ${street} 순서 테이블이 없습니다.`);
            return null;
        }

        // 활성 플레이어만 필터링
        const activePlayers = orderTable.filter(p =>
            this.playerStatus[p.player] === 'active'
        );

        if (activePlayers.length === 0) {
            console.log('액션 가능한 플레이어 없음');
            return null;
        }

        // 현재 인덱스의 플레이어 찾기 (street별 인덱스 정규화)
        const indexKey = street === 'preflop' ? 'preflop' : 'flop'; // postflop은 flop 인덱스 사용
        const currentIndex = this.currentActionIndex[indexKey] % activePlayers.length;
        return activePlayers[currentIndex];
    }

    /**
     * 다음 액션 플레이어로 이동
     * @param {String} street - 현재 스트리트
     */
    moveToNextPlayer(street) {
        // 스트리트별 인덱스 키 정규화
        const indexKey = street === 'preflop' ? 'preflop' : 'flop';
        this.currentActionIndex[indexKey]++;

        const nextPlayer = this.getCurrentPlayer(street);
        if (nextPlayer) {
            console.log(`다음 액션: ${nextPlayer.position}(${nextPlayer.player})`);
        }

        return nextPlayer;
    }

    /**
     * 플레이어 상태 업데이트
     * @param {String} playerName - 플레이어 이름
     * @param {String} status - 'active'|'folded'|'allin'
     */
    updatePlayerStatus(playerName, status) {
        const oldStatus = this.playerStatus[playerName];
        this.playerStatus[playerName] = status;

        console.log(`플레이어 상태 변경: ${playerName} ${oldStatus} → ${status}`);

        // 상태 변경 후 남은 활성 플레이어 확인
        const activePlayers = Object.keys(this.playerStatus).filter(
            p => this.playerStatus[p] === 'active'
        );

        console.log(`남은 활성 플레이어: ${activePlayers.length}명`);
        return activePlayers.length;
    }

    /**
     * 스트리트 전환
     * @param {String} newStreet - 새로운 스트리트
     */
    advanceToStreet(newStreet) {
        console.log(`=== 스트리트 전환: ${this.currentStreet} → ${newStreet} ===`);

        this.currentStreet = newStreet;

        // 스트리트별 액션 인덱스 초기화 (flop/turn/river는 flop 키 사용)
        const indexKey = newStreet === 'preflop' ? 'preflop' : 'flop';
        this.currentActionIndex[indexKey] = 0;

        // 새 스트리트의 첫 번째 플레이어
        const firstPlayer = this.getCurrentPlayer(newStreet);
        if (firstPlayer) {
            console.log(`${newStreet} 첫 액션: ${firstPlayer.position}(${firstPlayer.player})`);
        }

        return firstPlayer;
    }

    /**
     * 액션 순서 정보 가져오기
     * @param {String} street - 스트리트
     */
    getActionOrder(street) {
        // 스트리트 정규화: flop/turn/river는 모두 postflop 순서 사용
        const normalizedStreet = street === 'preflop' ? 'preflop' : 'postflop';
        const orderTable = this.absoluteOrder[normalizedStreet];

        if (!orderTable || orderTable.length === 0) {
            console.error(`ActionOrderManagerV2: ${street} 순서 테이블이 없습니다.`);
            return [];
        }

        return orderTable.map(p => ({
            ...p,
            status: this.playerStatus[p.player],
            canAct: this.playerStatus[p.player] === 'active'
        }));
    }

    /**
     * 베팅 라운드 완료 여부 확인
     * @param {String} street - 현재 스트리트
     * @param {Array} actions - 해당 스트리트의 액션 기록
     */
    isBettingRoundComplete(street, actions) {
        const activePlayers = this.getActionOrder(street).filter(p => p.canAct);

        // 1명만 남은 경우
        if (activePlayers.length <= 1) {
            console.log('1명만 남음 - 베팅 라운드 완료');
            return true;
        }

        // 모든 활성 플레이어가 액션했는지 확인
        const playerActions = {};
        actions.forEach(a => {
            if (a.player) {
                playerActions[a.player] = a.action;
            }
        });

        // 모든 활성 플레이어가 동일한 금액을 베팅했는지 확인
        const allActed = activePlayers.every(p =>
            playerActions[p.player] !== undefined
        );

        if (!allActed) {
            return false;
        }

        console.log('모든 플레이어 액션 완료 - 베팅 라운드 종료');
        return true;
    }

    /**
     * 핸드 종료 - 순서 초기화
     */
    endHand() {
        console.log(`=== 핸드 #${this.handNumber} 종료 - 순서 초기화 ===`);

        this.handNumber = null;
        this.absoluteOrder = {
            preflop: [],
            postflop: []
        };
        this.currentActionIndex = {
            preflop: 0,
            flop: 0,
            turn: 0,
            river: 0
        };
        this.playerStatus = {};
        this.currentStreet = 'preflop';

        console.log('액션 순서 매니저 초기화 완료');
    }

    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group(`ActionOrderManagerV2 - 핸드 #${this.handNumber}`);
        console.log('현재 스트리트:', this.currentStreet);
        console.log('버튼 위치:', this.buttonPosition);

        console.group('플레이어 상태:');
        Object.entries(this.playerStatus).forEach(([player, status]) => {
            console.log(`  ${player}: ${status}`);
        });
        console.groupEnd();

        console.group('프리플랍 순서:');
        this.absoluteOrder.preflop.forEach((p, i) => {
            const status = this.playerStatus[p.player];
            const marker = i === this.currentActionIndex.preflop ? '👉' : '  ';
            console.log(`${marker} ${p.priority}. ${p.position}(${p.player}) - ${status}`);
        });
        console.groupEnd();

        console.group('포스트플랍 순서:');
        this.absoluteOrder.postflop.forEach((p, i) => {
            const status = this.playerStatus[p.player];
            const marker = i === this.currentActionIndex[this.currentStreet] ? '👉' : '  ';
            console.log(`${marker} ${p.priority}. ${p.position}(${p.player}) - ${status}`);
        });
        console.groupEnd();

        console.groupEnd();
    }
}

// 전역 인스턴스 생성
window.actionOrderManager = new ActionOrderManagerV2();

// 기존 actionManager와의 호환성 레이어 (Breaking Change 방지)
window.actionManager = {
    ...window.actionOrderManager,

    // 호환성을 위한 별칭 메서드들
    calculateActionOrder(street) {
        return this.getActionOrder(street);
    },

    getActivePlayers(players) {
        return players.filter(p =>
            window.state.playerStatus[p.name] !== 'folded' &&
            window.state.playerStatus[p.name] !== 'allin'
        );
    },

    // ActionOrderManagerV2의 모든 메서드들을 프록시
    getCurrentActionPlayer() {
        return this.getCurrentPlayer();
    }
};

console.log('✅ ActionOrderManagerV2 로드 완료');