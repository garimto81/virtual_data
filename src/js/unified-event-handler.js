/**
 * 통합 이벤트 핸들러 클래스
 * 마우스와 터치 이벤트를 통합 관리하여 모바일/데스크톱 호환성 향상
 * @version 1.0.0
 */
class UnifiedEventHandler {
    constructor() {
        this.touchStartTime = 0;
        this.touchThreshold = 100; // 중복 터치 방지 임계값 (ms)
        this.activePointers = new Map(); // 활성 포인터 추적
        this.eventMap = new WeakMap(); // 요소별 이벤트 매핑
        this.preventDefault = true;
        this.passive = false;
    }

    /**
     * 통합 이벤트 리스너 등록
     * @param {HTMLElement} element - 대상 요소
     * @param {string} eventType - 이벤트 타입 ('tap', 'press', 'swipe')
     * @param {Function} handler - 이벤트 핸들러
     * @param {Object} options - 추가 옵션
     */
    addUnifiedListener(element, eventType, handler, options = {}) {
        if (!element || !handler) return;

        const config = {
            threshold: options.threshold || 10,
            duration: options.duration || 500,
            preventDefault: options.preventDefault !== undefined ? options.preventDefault : true,
            passive: options.passive || false,
            once: options.once || false
        };

        // 이벤트 타입별 처리
        switch(eventType) {
            case 'tap':
                this.addTapListener(element, handler, config);
                break;
            case 'press':
                this.addPressListener(element, handler, config);
                break;
            case 'swipe':
                this.addSwipeListener(element, handler, config);
                break;
            case 'drag':
                this.addDragListener(element, handler, config);
                break;
            default:
                console.warn(`Unknown event type: ${eventType}`);
        }

        // 이벤트 매핑 저장
        if (!this.eventMap.has(element)) {
            this.eventMap.set(element, new Map());
        }
        const elementEvents = this.eventMap.get(element);
        if (!elementEvents.has(eventType)) {
            elementEvents.set(eventType, []);
        }
        elementEvents.get(eventType).push({ handler, config });
    }

    /**
     * 탭 이벤트 리스너 추가
     */
    addTapListener(element, handler, config) {
        let startPos = null;
        let startTime = null;

        const handleStart = (e) => {
            const point = this.getEventPoint(e);
            startPos = { x: point.clientX, y: point.clientY };
            startTime = Date.now();

            // 시각적 피드백
            if (element.style) {
                element.style.transform = 'scale(0.98)';
                element.style.transition = 'transform 0.1s';
            }

            if (config.preventDefault && e.cancelable) {
                e.preventDefault();
            }
        };

        const handleEnd = (e) => {
            if (!startPos || !startTime) return;

            const point = this.getEventPoint(e);
            const deltaX = Math.abs(point.clientX - startPos.x);
            const deltaY = Math.abs(point.clientY - startPos.y);
            const deltaTime = Date.now() - startTime;

            // 시각적 피드백 복구
            if (element.style) {
                element.style.transform = '';
            }

            // 탭 조건 검증 (움직임이 적고 시간이 짧은 경우)
            if (deltaX < config.threshold &&
                deltaY < config.threshold &&
                deltaTime < config.duration) {

                // 통합 이벤트 객체 생성
                const unifiedEvent = this.createUnifiedEvent(e, {
                    type: 'tap',
                    duration: deltaTime,
                    position: startPos
                });

                handler.call(element, unifiedEvent);
            }

            startPos = null;
            startTime = null;
        };

        const handleCancel = () => {
            startPos = null;
            startTime = null;
            if (element.style) {
                element.style.transform = '';
            }
        };

        // 마우스와 터치 이벤트 모두 등록
        element.addEventListener('mousedown', handleStart, { passive: config.passive });
        element.addEventListener('touchstart', handleStart, { passive: config.passive });

        element.addEventListener('mouseup', handleEnd, { passive: true });
        element.addEventListener('touchend', handleEnd, { passive: true });

        element.addEventListener('mouseleave', handleCancel, { passive: true });
        element.addEventListener('touchcancel', handleCancel, { passive: true });
    }

    /**
     * 프레스(길게 누르기) 이벤트 리스너 추가
     */
    addPressListener(element, handler, config) {
        let pressTimer = null;
        let isPressing = false;

        const handleStart = (e) => {
            isPressing = true;

            pressTimer = setTimeout(() => {
                if (isPressing) {
                    const unifiedEvent = this.createUnifiedEvent(e, {
                        type: 'press',
                        duration: config.duration
                    });
                    handler.call(element, unifiedEvent);

                    // 햅틱 피드백 (지원하는 경우)
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }
            }, config.duration);

            if (config.preventDefault && e.cancelable) {
                e.preventDefault();
            }
        };

        const handleEnd = () => {
            isPressing = false;
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        element.addEventListener('mousedown', handleStart, { passive: config.passive });
        element.addEventListener('touchstart', handleStart, { passive: config.passive });

        element.addEventListener('mouseup', handleEnd, { passive: true });
        element.addEventListener('touchend', handleEnd, { passive: true });
        element.addEventListener('mouseleave', handleEnd, { passive: true });
        element.addEventListener('touchcancel', handleEnd, { passive: true });
    }

    /**
     * 스와이프 이벤트 리스너 추가
     */
    addSwipeListener(element, handler, config) {
        let startPos = null;
        let startTime = null;

        const handleStart = (e) => {
            const point = this.getEventPoint(e);
            startPos = { x: point.clientX, y: point.clientY };
            startTime = Date.now();
        };

        const handleEnd = (e) => {
            if (!startPos || !startTime) return;

            const point = this.getEventPoint(e);
            const deltaX = point.clientX - startPos.x;
            const deltaY = point.clientY - startPos.y;
            const deltaTime = Date.now() - startTime;

            // 스와이프 감지 (빠른 움직임)
            if (deltaTime < 500) {
                let direction = null;

                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    // 수평 스와이프
                    if (Math.abs(deltaX) > 50) {
                        direction = deltaX > 0 ? 'right' : 'left';
                    }
                } else {
                    // 수직 스와이프
                    if (Math.abs(deltaY) > 50) {
                        direction = deltaY > 0 ? 'down' : 'up';
                    }
                }

                if (direction) {
                    const unifiedEvent = this.createUnifiedEvent(e, {
                        type: 'swipe',
                        direction: direction,
                        distance: { x: deltaX, y: deltaY },
                        duration: deltaTime
                    });
                    handler.call(element, unifiedEvent);
                }
            }

            startPos = null;
            startTime = null;
        };

        element.addEventListener('mousedown', handleStart, { passive: config.passive });
        element.addEventListener('touchstart', handleStart, { passive: config.passive });

        element.addEventListener('mouseup', handleEnd, { passive: true });
        element.addEventListener('touchend', handleEnd, { passive: true });
    }

    /**
     * 드래그 이벤트 리스너 추가
     */
    addDragListener(element, handler, config) {
        let isDragging = false;
        let startPos = null;
        let currentPos = null;

        const handleStart = (e) => {
            const point = this.getEventPoint(e);
            startPos = { x: point.clientX, y: point.clientY };
            currentPos = { ...startPos };
            isDragging = true;

            const unifiedEvent = this.createUnifiedEvent(e, {
                type: 'dragstart',
                position: startPos
            });
            handler.call(element, unifiedEvent);

            if (config.preventDefault && e.cancelable) {
                e.preventDefault();
            }
        };

        const handleMove = (e) => {
            if (!isDragging) return;

            const point = this.getEventPoint(e);
            currentPos = { x: point.clientX, y: point.clientY };

            const unifiedEvent = this.createUnifiedEvent(e, {
                type: 'dragmove',
                position: currentPos,
                delta: {
                    x: currentPos.x - startPos.x,
                    y: currentPos.y - startPos.y
                }
            });
            handler.call(element, unifiedEvent);

            if (config.preventDefault && e.cancelable) {
                e.preventDefault();
            }
        };

        const handleEnd = (e) => {
            if (!isDragging) return;

            isDragging = false;
            const unifiedEvent = this.createUnifiedEvent(e, {
                type: 'dragend',
                position: currentPos,
                delta: {
                    x: currentPos.x - startPos.x,
                    y: currentPos.y - startPos.y
                }
            });
            handler.call(element, unifiedEvent);

            startPos = null;
            currentPos = null;
        };

        element.addEventListener('mousedown', handleStart, { passive: config.passive });
        element.addEventListener('touchstart', handleStart, { passive: config.passive });

        document.addEventListener('mousemove', handleMove, { passive: config.passive });
        document.addEventListener('touchmove', handleMove, { passive: config.passive });

        document.addEventListener('mouseup', handleEnd, { passive: true });
        document.addEventListener('touchend', handleEnd, { passive: true });
    }

    /**
     * 이벤트 포인트 추출 (마우스/터치 통합)
     */
    getEventPoint(e) {
        if (e.touches && e.touches.length > 0) {
            return e.touches[0];
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return e.changedTouches[0];
        }
        return e;
    }

    /**
     * 통합 이벤트 객체 생성
     */
    createUnifiedEvent(originalEvent, customData = {}) {
        const point = this.getEventPoint(originalEvent);

        return {
            originalEvent: originalEvent,
            type: customData.type || 'unified',
            target: originalEvent.target,
            currentTarget: originalEvent.currentTarget,
            timeStamp: originalEvent.timeStamp,
            clientX: point.clientX,
            clientY: point.clientY,
            pageX: point.pageX,
            pageY: point.pageY,
            screenX: point.screenX,
            screenY: point.screenY,
            ...customData,
            preventDefault: () => originalEvent.preventDefault(),
            stopPropagation: () => originalEvent.stopPropagation()
        };
    }

    /**
     * 이벤트 리스너 제거
     */
    removeUnifiedListener(element, eventType, handler) {
        if (!this.eventMap.has(element)) return;

        const elementEvents = this.eventMap.get(element);
        if (!elementEvents.has(eventType)) return;

        const handlers = elementEvents.get(eventType);
        const index = handlers.findIndex(h => h.handler === handler);

        if (index !== -1) {
            handlers.splice(index, 1);
            if (handlers.length === 0) {
                elementEvents.delete(eventType);
            }
        }
    }

    /**
     * 요소의 모든 이벤트 리스너 제거
     */
    removeAllListeners(element) {
        if (!this.eventMap.has(element)) return;

        // TODO: 실제 이벤트 리스너 제거 로직 구현
        this.eventMap.delete(element);
    }

    /**
     * 포인터 이벤트 지원 여부 확인
     */
    static supportsPointerEvents() {
        return 'PointerEvent' in window;
    }

    /**
     * 터치 이벤트 지원 여부 확인
     */
    static supportsTouchEvents() {
        return 'ontouchstart' in window ||
               navigator.maxTouchPoints > 0 ||
               navigator.msMaxTouchPoints > 0;
    }

    /**
     * 디바이스 타입 감지
     */
    static getDeviceType() {
        const hasTouch = UnifiedEventHandler.supportsTouchEvents();
        const hasMouse = matchMedia('(pointer:fine)').matches;

        if (hasTouch && !hasMouse) return 'touch';
        if (!hasTouch && hasMouse) return 'mouse';
        if (hasTouch && hasMouse) return 'hybrid';
        return 'unknown';
    }
}

// 전역 인스턴스 생성
window.unifiedEventHandler = new UnifiedEventHandler();