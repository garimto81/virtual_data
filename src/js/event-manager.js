/**
 * 이벤트 매니저 클래스
 * 이벤트 리스너 중복 등록 방지 및 메모리 누수 해결
 * @version 1.0.0
 */
class EventManager {
    constructor() {
        // 이벤트 리스너 추적
        this.listeners = new Map();
        // 요소별 이벤트 그룹
        this.elementGroups = new WeakMap();
        // 글로벌 이벤트 ID 카운터
        this.eventIdCounter = 0;
        // 디버그 모드
        this.debugMode = false;

        // 페이지 언로드 시 자동 정리
        this.setupUnloadHandler();
    }

    /**
     * 이벤트 리스너 추가 (중복 방지)
     * @param {HTMLElement} element - 대상 요소
     * @param {string} eventType - 이벤트 타입
     * @param {Function} handler - 이벤트 핸들러
     * @param {Object} options - 이벤트 옵션
     * @returns {string} 이벤트 ID
     */
    addEventListener(element, eventType, handler, options = {}) {
        if (!element || !eventType || !handler) {
            console.error('EventManager: Invalid parameters');
            return null;
        }

        // 고유 이벤트 ID 생성
        const eventId = this.generateEventId(element, eventType, handler);

        // 이미 등록된 동일한 이벤트가 있는지 확인
        if (this.listeners.has(eventId)) {
            if (this.debugMode) {
                console.warn(`EventManager: Event already registered: ${eventId}`);
            }
            // 기존 리스너 제거 후 재등록
            this.removeEventListener(eventId);
        }

        // 래퍼 함수 생성 (메모리 관리 및 에러 처리)
        const wrappedHandler = this.createWrappedHandler(handler, eventId);

        // 이벤트 정보 저장
        const eventInfo = {
            element,
            eventType,
            handler,
            wrappedHandler,
            options,
            timestamp: Date.now(),
            callCount: 0
        };

        this.listeners.set(eventId, eventInfo);

        // 요소별 그룹에 추가
        this.addToElementGroup(element, eventId);

        // 실제 이벤트 리스너 등록
        element.addEventListener(eventType, wrappedHandler, options);

        if (this.debugMode) {
            console.log(`EventManager: Added listener ${eventId}`);
        }

        return eventId;
    }

    /**
     * 이벤트 리스너 제거
     * @param {string} eventId - 이벤트 ID
     * @returns {boolean} 제거 성공 여부
     */
    removeEventListener(eventId) {
        const eventInfo = this.listeners.get(eventId);
        if (!eventInfo) {
            return false;
        }

        const { element, eventType, wrappedHandler, options } = eventInfo;

        // 실제 이벤트 리스너 제거
        element.removeEventListener(eventType, wrappedHandler, options);

        // 저장된 정보 삭제
        this.listeners.delete(eventId);

        // 요소 그룹에서 제거
        this.removeFromElementGroup(element, eventId);

        if (this.debugMode) {
            console.log(`EventManager: Removed listener ${eventId}`);
        }

        return true;
    }

    /**
     * 특정 요소의 모든 이벤트 리스너 제거
     * @param {HTMLElement} element - 대상 요소
     * @returns {number} 제거된 리스너 수
     */
    removeAllEventListeners(element) {
        const group = this.elementGroups.get(element);
        if (!group || group.size === 0) {
            return 0;
        }

        let removedCount = 0;
        for (const eventId of group) {
            if (this.removeEventListener(eventId)) {
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * 특정 타입의 모든 이벤트 리스너 제거
     * @param {string} eventType - 이벤트 타입
     * @returns {number} 제거된 리스너 수
     */
    removeEventListenersByType(eventType) {
        let removedCount = 0;
        const toRemove = [];

        for (const [eventId, eventInfo] of this.listeners) {
            if (eventInfo.eventType === eventType) {
                toRemove.push(eventId);
            }
        }

        for (const eventId of toRemove) {
            if (this.removeEventListener(eventId)) {
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * 모든 이벤트 리스너 제거
     * @returns {number} 제거된 리스너 수
     */
    removeAllListeners() {
        let removedCount = 0;
        const allIds = Array.from(this.listeners.keys());

        for (const eventId of allIds) {
            if (this.removeEventListener(eventId)) {
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * 이벤트 리스너 일시 중지
     * @param {string} eventId - 이벤트 ID
     */
    pauseEventListener(eventId) {
        const eventInfo = this.listeners.get(eventId);
        if (eventInfo) {
            eventInfo.paused = true;
        }
    }

    /**
     * 이벤트 리스너 재개
     * @param {string} eventId - 이벤트 ID
     */
    resumeEventListener(eventId) {
        const eventInfo = this.listeners.get(eventId);
        if (eventInfo) {
            eventInfo.paused = false;
        }
    }

    /**
     * 래퍼 핸들러 생성
     */
    createWrappedHandler(handler, eventId) {
        return (event) => {
            const eventInfo = this.listeners.get(eventId);

            // 이벤트가 일시 중지된 경우
            if (eventInfo?.paused) {
                return;
            }

            // 호출 횟수 증가
            if (eventInfo) {
                eventInfo.callCount++;
                eventInfo.lastCalled = Date.now();
            }

            // 에러 처리
            try {
                return handler.call(this, event);
            } catch (error) {
                console.error(`EventManager: Error in handler ${eventId}:`, error);

                // 에러 발생 시 자동으로 리스너 제거 옵션
                if (eventInfo?.options?.removeOnError) {
                    this.removeEventListener(eventId);
                }
            }
        };
    }

    /**
     * 고유 이벤트 ID 생성
     */
    generateEventId(element, eventType, handler) {
        // 요소 고유 ID 생성
        const elementId = element.id ||
                         element.className ||
                         element.tagName ||
                         'element';

        // 핸들러 고유 식별자
        const handlerStr = handler.toString().substring(0, 50);
        const handlerHash = this.simpleHash(handlerStr);

        // 고유 ID 조합
        return `${elementId}_${eventType}_${handlerHash}_${++this.eventIdCounter}`;
    }

    /**
     * 간단한 해시 함수
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * 요소 그룹에 추가
     */
    addToElementGroup(element, eventId) {
        if (!this.elementGroups.has(element)) {
            this.elementGroups.set(element, new Set());
        }
        this.elementGroups.get(element).add(eventId);
    }

    /**
     * 요소 그룹에서 제거
     */
    removeFromElementGroup(element, eventId) {
        const group = this.elementGroups.get(element);
        if (group) {
            group.delete(eventId);
            if (group.size === 0) {
                this.elementGroups.delete(element);
            }
        }
    }

    /**
     * 페이지 언로드 핸들러 설정
     */
    setupUnloadHandler() {
        const cleanup = () => {
            const count = this.removeAllListeners();
            if (this.debugMode) {
                console.log(`EventManager: Cleaned up ${count} listeners on unload`);
            }
        };

        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);
    }

    /**
     * 메모리 사용량 확인
     * @returns {Object} 메모리 통계
     */
    getMemoryStats() {
        const stats = {
            totalListeners: this.listeners.size,
            elementsWithListeners: 0,
            eventTypes: new Set(),
            oldestListener: null,
            mostCalledListener: null
        };

        let oldestTime = Infinity;
        let maxCalls = 0;

        for (const [eventId, eventInfo] of this.listeners) {
            stats.eventTypes.add(eventInfo.eventType);

            if (eventInfo.timestamp < oldestTime) {
                oldestTime = eventInfo.timestamp;
                stats.oldestListener = eventId;
            }

            if (eventInfo.callCount > maxCalls) {
                maxCalls = eventInfo.callCount;
                stats.mostCalledListener = {
                    id: eventId,
                    calls: eventInfo.callCount
                };
            }
        }

        stats.eventTypes = Array.from(stats.eventTypes);
        stats.elementsWithListeners = this.elementGroups.size || 0;

        return stats;
    }

    /**
     * 오래된 리스너 정리
     * @param {number} maxAge - 최대 수명 (밀리초)
     * @returns {number} 제거된 리스너 수
     */
    cleanupOldListeners(maxAge = 3600000) { // 기본 1시간
        const now = Date.now();
        let removedCount = 0;
        const toRemove = [];

        for (const [eventId, eventInfo] of this.listeners) {
            if (now - eventInfo.timestamp > maxAge) {
                toRemove.push(eventId);
            }
        }

        for (const eventId of toRemove) {
            if (this.removeEventListener(eventId)) {
                removedCount++;
            }
        }

        if (this.debugMode && removedCount > 0) {
            console.log(`EventManager: Cleaned up ${removedCount} old listeners`);
        }

        return removedCount;
    }

    /**
     * 사용되지 않는 리스너 정리
     * @param {number} maxIdleTime - 최대 유휴 시간 (밀리초)
     * @returns {number} 제거된 리스너 수
     */
    cleanupIdleListeners(maxIdleTime = 1800000) { // 기본 30분
        const now = Date.now();
        let removedCount = 0;
        const toRemove = [];

        for (const [eventId, eventInfo] of this.listeners) {
            const lastCalled = eventInfo.lastCalled || eventInfo.timestamp;
            if (eventInfo.callCount === 0 && (now - lastCalled) > maxIdleTime) {
                toRemove.push(eventId);
            }
        }

        for (const eventId of toRemove) {
            if (this.removeEventListener(eventId)) {
                removedCount++;
            }
        }

        if (this.debugMode && removedCount > 0) {
            console.log(`EventManager: Cleaned up ${removedCount} idle listeners`);
        }

        return removedCount;
    }

    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('EventManager Debug Info');
        console.log('Total Listeners:', this.listeners.size);
        console.log('Memory Stats:', this.getMemoryStats());

        console.group('Active Listeners:');
        for (const [eventId, eventInfo] of this.listeners) {
            console.log(`${eventId}:`, {
                eventType: eventInfo.eventType,
                callCount: eventInfo.callCount,
                paused: eventInfo.paused || false,
                age: Date.now() - eventInfo.timestamp
            });
        }
        console.groupEnd();

        console.groupEnd();
    }

    /**
     * 자동 정리 시작
     * @param {number} interval - 정리 간격 (밀리초)
     */
    startAutoCleanup(interval = 300000) { // 기본 5분
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            const oldRemoved = this.cleanupOldListeners();
            const idleRemoved = this.cleanupIdleListeners();

            if (this.debugMode && (oldRemoved + idleRemoved) > 0) {
                console.log(`EventManager: Auto cleanup removed ${oldRemoved + idleRemoved} listeners`);
            }
        }, interval);
    }

    /**
     * 자동 정리 중지
     */
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// 전역 인스턴스 생성
window.eventManager = new EventManager();

// 개발 환경에서 자동 정리 시작
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.eventManager.debugMode = true;
    window.eventManager.startAutoCleanup();
}