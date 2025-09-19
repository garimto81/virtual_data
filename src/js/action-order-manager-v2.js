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
     * @param {Number} buttonPosition - 버튼 위치
     * @param {String} handNumber - 핸드 번호
     */
    initializeHand(playersInHand, buttonPosition, handNumber) {
        console.log(`=== 핸드 #${handNumber} 절대 순위 초기화 ===`);

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

        // 절대 순위 테이블 생성
        this.absoluteOrder = {
            preflop: this.createPreflopOrder(playersInHand, buttonPosition),
            postflop: this.createPostflopOrder(playersInHand, buttonPosition)
        };

        console.log('프리플랍 순서:', this.absoluteOrder.preflop.map(p =>
            `${p.position}(${p.player})`).join(' → '));
        console.log('포스트플랍 순서:', this.absoluteOrder.postflop.map(p =>
            `${p.position}(${p.player})`).join(' → '));

        return this;
    }

    /**
     * 프리플랍 절대 순위 생성
     */
    createPreflopOrder(players, buttonPosition) {
        const order = [];
        const seatMap = new Map();

        players.forEach(p => {
            seatMap.set(p.seat, p);
        });

        const occupiedSeats = Array.from(seatMap.keys()).sort((a, b) => a - b);
        const totalPlayers = occupiedSeats.length;

        // 버튼 위치 찾기
        const btnIndex = occupiedSeats.indexOf(buttonPosition);
        if (btnIndex === -1) {
            console.error('버튼 위치를 찾을 수 없음');
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

        // 프리플랍 액션 순서: UTG → BTN → SB → BB
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

        return order;
    }

    /**
     * 포스트플랍 절대 순위 생성
     */
    createPostflopOrder(players, buttonPosition) {
        const order = [];
        const seatMap = new Map();

        players.forEach(p => {
            seatMap.set(p.seat, p);
        });

        const occupiedSeats = Array.from(seatMap.keys()).sort((a, b) => a - b);
        const totalPlayers = occupiedSeats.length;

        // 버튼 위치 찾기
        const btnIndex = occupiedSeats.indexOf(buttonPosition);
        if (btnIndex === -1) {
            console.error('버튼 위치를 찾을 수 없음');
            return order;
        }

        // 포스트플랍 액션 순서: SB → BB → UTG → ... → BTN
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

            order.push({
                player: player.name,
                seat: seat,
                position: position,
                priority: i
            });
        }

        return order;
    }

    /**
     * 현재 액션할 플레이어 가져오기
     * @param {String} street - 현재 스트리트
     */
    getCurrentPlayer(street) {
        const orderTable = street === 'preflop' ?
            this.absoluteOrder.preflop :
            this.absoluteOrder.postflop;

        // 활성 플레이어만 필터링
        const activePlayers = orderTable.filter(p =>
            this.playerStatus[p.player] === 'active'
        );

        if (activePlayers.length === 0) {
            console.log('액션 가능한 플레이어 없음');
            return null;
        }

        // 현재 인덱스의 플레이어 찾기
        const currentIndex = this.currentActionIndex[street] % activePlayers.length;
        return activePlayers[currentIndex];
    }

    /**
     * 다음 액션 플레이어로 이동
     * @param {String} street - 현재 스트리트
     */
    moveToNextPlayer(street) {
        this.currentActionIndex[street]++;

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
        this.currentActionIndex[newStreet] = 0;

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
        const orderTable = street === 'preflop' ?
            this.absoluteOrder.preflop :
            this.absoluteOrder.postflop;

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

// 기존 actionManager와의 호환성 레이어
window.actionManager = {
    ...window.actionOrderManager,

    // 호환성을 위한 별칭
    calculateActionOrder(street) {
        return this.getActionOrder(street);
    },

    getActivePlayers(players) {
        return players.filter(p =>
            this.playerStatus[p.name] === 'active'
        );
    }
};

console.log('✅ ActionOrderManagerV2 로드 완료');