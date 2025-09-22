/****************************************************
 * Poker Hand Logger - Apps Script Backend v66 (최적화 버전)
 * 데이터 중복 처리 효율화 - 인덱싱 및 증분 검사
 *
 * v66 변경사항 (2025-09-19):
 * - removeDuplicatePlayers() 함수 최적화
 * - 인덱스 기반 중복 검사로 성능 향상
 * - 증분 검사 방식으로 전체 스캔 최소화
 * - 배치 삭제로 API 호출 감소
 * - 메모리 효율적인 처리 방식 적용
 ****************************************************/

// 기존 상수 유지
const SHEET_ID = '1J-lf8bYTLPbpdhieUNdb8ckW_uwdQ3MtSBLmyRIwH7U';

const TYPE_COLUMNS = {
  PLAYER: 0,      // A열 - Player
  TABLE: 1,       // B열 - Table
  NOTABLE: 2,     // C열 - Notable
  CHIPS: 3,       // D열 - Chips
  UPDATED_AT: 4,  // E열 - UpdatedAt
  SEAT: 5,        // F열 - Seat
  STATUS: 6       // G열 - Status
};

const RANGE_COLUMNS = {
  PLAYER: 1,      // A열
  TABLE: 2,       // B열
  NOTABLE: 3,     // C열
  CHIPS: 4,       // D열
  UPDATED_AT: 5,  // E열
  SEAT: 6,        // F열
  STATUS: 7       // G열
};

// ===== 최적화된 중복 제거 시스템 =====

/**
 * 플레이어 인덱스 캐시
 * 메모리에 플레이어 인덱스를 유지하여 빠른 중복 검사
 */
class PlayerIndexCache {
  constructor() {
    this.cache = new Map();
    this.lastUpdate = 0;
    this.cacheLifetime = 60000; // 1분
  }

  /**
   * 캐시 유효성 확인
   */
  isValid() {
    return Date.now() - this.lastUpdate < this.cacheLifetime;
  }

  /**
   * 캐시 갱신
   */
  refresh(data) {
    this.cache.clear();

    // 헤더 제외하고 인덱싱
    for (let i = 1; i < data.length; i++) {
      const playerName = data[i][TYPE_COLUMNS.PLAYER];
      const tableName = data[i][TYPE_COLUMNS.TABLE];
      const status = data[i][TYPE_COLUMNS.STATUS];

      if (status === 'IN' && playerName && tableName) {
        const key = `${tableName}_${playerName}`;

        if (!this.cache.has(key)) {
          this.cache.set(key, []);
        }
        this.cache.get(key).push({
          row: i + 1,
          chips: data[i][TYPE_COLUMNS.CHIPS],
          updatedAt: data[i][TYPE_COLUMNS.UPDATED_AT],
          seat: data[i][TYPE_COLUMNS.SEAT]
        });
      }
    }

    this.lastUpdate = Date.now();
    return this.cache;
  }

  /**
   * 중복 플레이어 찾기
   */
  findDuplicates() {
    const duplicates = [];

    for (const [key, entries] of this.cache) {
      if (entries.length > 1) {
        // 가장 최근 업데이트된 항목 유지, 나머지는 삭제
        entries.sort((a, b) => {
          // UpdatedAt 기준 정렬 (최신 순)
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA;
        });

        // 첫 번째(최신)를 제외한 나머지를 삭제 대상으로
        for (let i = 1; i < entries.length; i++) {
          duplicates.push({
            key: key,
            row: entries[i].row,
            reason: `중복 플레이어 (${key})`
          });
        }
      }
    }

    return duplicates;
  }
}

// 전역 캐시 인스턴스
let playerCache = new PlayerIndexCache();

/**
 * 최적화된 중복 플레이어 제거 함수
 * - 인덱스 기반 검색으로 O(n²) → O(n) 성능 개선
 * - 배치 삭제로 API 호출 최소화
 * - 증분 검사 지원
 */
function removeDuplicatePlayersOptimized(incremental = false) {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return {success: false, message: 'Type 시트를 찾을 수 없습니다'};

    console.log('[v66] 최적화된 중복 제거 시작...');
    const startTime = Date.now();

    // 데이터 로드
    const data = sheet.getDataRange().getValues();

    // 캐시 갱신 또는 생성
    if (!incremental || !playerCache.isValid()) {
      console.log('[v66] 플레이어 인덱스 캐시 갱신...');
      playerCache.refresh(data);
    }

    // 중복 찾기
    const duplicates = playerCache.findDuplicates();

    if (duplicates.length === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`[v66] 중복 없음 (처리 시간: ${elapsed}ms)`);
      return {
        success: true,
        message: '중복 플레이어 없음',
        stats: {
          checked: playerCache.cache.size,
          duplicates: 0,
          elapsed: elapsed
        }
      };
    }

    // 배치 삭제 준비
    console.log(`[v66] ${duplicates.length}개 중복 발견, 배치 삭제 준비...`);

    // 행 번호 내림차순 정렬 (삭제 시 행 번호 변경 방지)
    duplicates.sort((a, b) => b.row - a.row);

    // 배치 삭제 실행 - Range를 사용한 최적화
    const ranges = [];
    let currentRange = null;

    for (const dup of duplicates) {
      if (!currentRange || dup.row !== currentRange.start - 1) {
        // 새로운 범위 시작
        currentRange = {
          start: dup.row,
          end: dup.row,
          count: 1
        };
        ranges.push(currentRange);
      } else {
        // 연속된 범위 확장
        currentRange.start = dup.row;
        currentRange.count++;
      }
    }

    // 범위별로 삭제 (큰 범위부터)
    let totalDeleted = 0;
    for (const range of ranges) {
      if (range.count > 1) {
        // 여러 행을 한 번에 삭제
        sheet.deleteRows(range.start, range.count);
        console.log(`[v66] 행 ${range.start}-${range.end} (${range.count}개) 배치 삭제`);
      } else {
        // 단일 행 삭제
        sheet.deleteRow(range.start);
        console.log(`[v66] 행 ${range.start} 삭제`);
      }
      totalDeleted += range.count;
    }

    // 캐시 무효화 (다음 호출 시 갱신)
    playerCache.lastUpdate = 0;

    const elapsed = Date.now() - startTime;
    console.log(`[v66] 중복 제거 완료 (처리 시간: ${elapsed}ms)`);

    return {
      success: true,
      message: `중복 플레이어 ${totalDeleted}개 제거됨`,
      stats: {
        checked: playerCache.cache.size,
        duplicates: totalDeleted,
        elapsed: elapsed,
        ranges: ranges.length
      }
    };

  } catch (error) {
    console.error('[v66] removeDuplicatePlayersOptimized error:', error);
    return {
      success: false,
      message: error.toString(),
      error: error.stack
    };
  }
}

/**
 * 증분 중복 검사 함수
 * 특정 플레이어만 검사하여 성능 향상
 */
function checkDuplicateForPlayer(playerName, tableName) {
  try {
    const key = `${tableName}_${playerName}`;

    // 캐시가 유효하지 않으면 갱신
    if (!playerCache.isValid()) {
      const sheet = _open().getSheetByName('Type');
      const data = sheet.getDataRange().getValues();
      playerCache.refresh(data);
    }

    // 특정 플레이어의 중복 확인
    const entries = playerCache.cache.get(key);

    if (!entries || entries.length <= 1) {
      return {
        success: true,
        isDuplicate: false,
        count: entries ? entries.length : 0
      };
    }

    return {
      success: true,
      isDuplicate: true,
      count: entries.length,
      duplicates: entries
    };

  } catch (error) {
    console.error('[v66] checkDuplicateForPlayer error:', error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 스마트 중복 제거
 * 조건에 따라 전체 또는 증분 검사 자동 선택
 */
function smartRemoveDuplicates(recentChanges = []) {
  try {
    console.log('[v66] 스마트 중복 제거 시작...');

    // 최근 변경 사항이 적으면 증분 검사
    if (recentChanges.length > 0 && recentChanges.length <= 5) {
      console.log(`[v66] 증분 검사 모드 (${recentChanges.length}개 변경)`);

      let duplicatesFound = false;
      for (const change of recentChanges) {
        const result = checkDuplicateForPlayer(change.player, change.table);
        if (result.isDuplicate) {
          duplicatesFound = true;
          break;
        }
      }

      if (duplicatesFound) {
        // 중복 발견 시 전체 정리
        return removeDuplicatePlayersOptimized(false);
      }

      return {
        success: true,
        message: '증분 검사 완료 - 중복 없음',
        mode: 'incremental'
      };
    }

    // 변경 사항이 많으면 전체 검사
    console.log('[v66] 전체 검사 모드');
    return removeDuplicatePlayersOptimized(false);

  } catch (error) {
    console.error('[v66] smartRemoveDuplicates error:', error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 배치 업데이트 최적화
 * 트랜잭션 방식으로 처리
 */
function batchUpdatePlayersOptimized(tableName, playersJson, deletedJson) {
  try {
    const sheet = _open().getSheetByName('Type');
    const players = typeof playersJson === 'string' ? JSON.parse(playersJson) : playersJson;
    const deleted = typeof deletedJson === 'string' ? JSON.parse(deletedJson) : deletedJson;

    console.log('[v66] 최적화된 배치 업데이트 시작...');
    const startTime = Date.now();

    // 변경 추적
    const changes = [];

    // 1. 삭제 처리 (배치)
    if (deleted.length > 0) {
      const data = sheet.getDataRange().getValues();
      const rowsToDelete = [];

      for (const playerName of deleted) {
        for (let i = 1; i < data.length; i++) {
          if (data[i][TYPE_COLUMNS.PLAYER] === playerName &&
              data[i][TYPE_COLUMNS.TABLE] === tableName) {
            rowsToDelete.push(i + 1);
            break;
          }
        }
      }

      // 내림차순 정렬 후 삭제
      rowsToDelete.sort((a, b) => b - a);
      for (const row of rowsToDelete) {
        sheet.deleteRow(row);
      }
    }

    // 2. 업데이트/추가 처리 (배치)
    const data = sheet.getDataRange().getValues();
    const updates = [];
    const additions = [];

    for (const player of players) {
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][TYPE_COLUMNS.PLAYER] === player.name &&
            data[i][TYPE_COLUMNS.TABLE] === tableName &&
            data[i][TYPE_COLUMNS.STATUS] === 'IN') {

          updates.push({
            row: i + 1,
            player: player
          });
          found = true;
          break;
        }
      }

      if (!found) {
        additions.push(player);
      }

      changes.push({
        player: player.name,
        table: tableName
      });
    }

    // 배치 업데이트 실행
    const now = new Date();

    // 업데이트
    for (const update of updates) {
      const row = update.row;
      const player = update.player;

      sheet.getRange(row, RANGE_COLUMNS.CHIPS).setValue(player.chips || 0);
      sheet.getRange(row, RANGE_COLUMNS.SEAT).setValue(player.seat || '');
      sheet.getRange(row, RANGE_COLUMNS.UPDATED_AT).setValue(now);

      if (player.notable !== undefined) {
        sheet.getRange(row, RANGE_COLUMNS.NOTABLE).setValue(player.notable ? 'TRUE' : 'FALSE');
      }
    }

    // 추가
    if (additions.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      const newData = additions.map(player => [
        '',  // CAMERA
        player.name,  // PLAYER
        tableName,  // TABLE
        player.notable ? 'TRUE' : 'FALSE',  // NOTABLE
        player.chips || 0,  // CHIPS
        now,  // UPDATED_AT
        player.seat || '',  // SEAT
        'IN'  // STATUS
      ]);

      sheet.getRange(startRow, 1, newData.length, 8).setValues(newData);
    }

    // 3. 스마트 중복 제거
    const cleanupResult = smartRemoveDuplicates(changes);

    // 4. 정렬
    sortTypeSheet();

    const elapsed = Date.now() - startTime;

    return {
      success: true,
      message: '최적화된 배치 업데이트 완료',
      stats: {
        updated: updates.length,
        added: additions.length,
        deleted: deleted.length,
        duplicatesRemoved: cleanupResult.stats?.duplicates || 0,
        elapsed: elapsed
      }
    };

  } catch (error) {
    console.error('[v66] batchUpdatePlayersOptimized error:', error);
    return {
      success: false,
      message: error.toString(),
      error: error.stack
    };
  }
}

// 기존 함수명 호환성 유지 (별칭)
const removeDuplicatePlayers = removeDuplicatePlayersOptimized;
const batchUpdatePlayers = batchUpdatePlayersOptimized;